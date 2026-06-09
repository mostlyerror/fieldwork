# Metered DUPR Access Layer — Design

Goal: always-as-fresh-as-possible player data **without** getting cut off from DUPR.
DUPR access is existential (it blocks datacenter IPs already; we route through a
residential proxy). Today every caller re-implements auth/pacing/retry and nothing
coordinates globally. This doc maps the current call sites, then designs one shared,
metered layer — scoped 80/20 for a pre-launch site (no persistent worker/queue infra).

## 1. Current call-site map

All DUPR HTTP already funnels through `utils/dupr-fetch.ts` (`duprFetch`) — but that
wrapper ONLY injects the residential proxy. Auth, headers, pacing, retry, and
selection are copied per caller:

| Caller | Trigger | Login impl | Pacing | 429 retry | Who it picks | ~Requests |
|---|---|---|---|---|---|---|
| `utils/dupr-enrichment.ts` (ratings via search) | scrape.yml 2×/day via index.ts | own, partial browser headers | humanDelay 2–5s, 12% long pause | 2× backoff 25–90s | `dupr_last_checked` >7d, ASC, 50/run | ~50/run |
| `utils/match-history.ts` `fetchAllMatchHistory` | enrich-matches.yml 2×/day **and** scrape.yml via index.ts | token passed in; enrich-matches.ts uses a **bare** login (known-flaky: "Bad request format" without browser headers) | same constants, duplicated | same, duplicated | `matches_last_checked` >7d ASC NULLS FIRST, verified + dupr_id, 30/run | 30 players × ~3 (search + history pages) |
| `utils/match-history.ts` `fetchTournamentRosterHistory` | urgent-refresh.yml hourly | run-urgent-refresh.ts's own login (full browser headers — the one that works) | same | same | RPC `get_roster_players_to_refresh` (migration 031 priority), 12/run, 24h floor | 12 × ~3 hourly |
| `pull-player.ts` | pull-player.yml workflow_dispatch | own copy of the browser-header login | inherits processPlayer | same | explicit PLAYER_ID | ~3 |
| `backfill-rating-history.ts` | manual CLI | own bare login | own ad-hoc sleeps | **none** | first N verified players (no ordering) | N × ~3 |
| `backfill-player.ts` | manual CLI | own bare login | own ad-hoc sleeps | **none** | explicit DUPR_ID | ~4 |
| index.ts re-login (line ~281) | scrape.yml | **bare** login (no browser headers) | — | — | — | 1 |
| `utils/scrape-dupr-ids.ts` | scrape.yml | n/a — hits pickleball.com, not DUPR (uses global fetch, not duprFetch) | 1.5s fixed | none | players missing dupr_id, 50/run | 0 DUPR |
| Task #31 (future): profile endpoint for verified/provisional | TBD | — | — | — | per player pulled | +1/pull |

### Problems this surfaces

1. **4 login implementations, 2 of them known-flaky.** The bare `{email,password}`
   POST (enrich-matches.ts, index.ts, both backfills) fails from CI without browser
   headers. The working one (Origin/Referer/UA) exists in run-urgent-refresh.ts and
   pull-player.ts. Copies drift.
2. **No global budget.** scrape.yml (50 searches + 30 history pulls), enrich-matches.yml
   (30 pulls), and urgent-refresh (12/hr) each pace themselves but never see each other.
   Worst-case ≈ 1,500–1,800 DUPR requests/day through one proxy identity.
3. **Concurrent jobs can overlap.** urgent-refresh / enrich-matches / pull-player share
   the `urgent-refresh` concurrency group — good. **scrape.yml does not**, so its DUPR
   section can run simultaneously with the hourly roster pass. Two interleaved request
   streams through one residential IP is exactly the non-human pattern to avoid.
4. **A wasted search on every pull.** Each history pull burns a `/player/v1.0/search`
   request just to re-resolve the player's numeric DUPR id — which never changes.
   That's ~⅓ of repeat-pull volume.
5. **Per-request UA roulette.** All three UA pools randomize the User-Agent *per
   request*. Real browsers keep one UA per session. Randomizing within a session is a
   bot tell, not camouflage.
6. **Two overlapping refresh tracks.** Ratings (search → `dupr_last_checked`) and match
   history (`matches_last_checked`) are separate queues hitting the same players. A
   single per-player pull could refresh both (and verified/provisional, task #31) at once.
7. **Backfill CLIs have no retry, no ordering, no budget** — a manual run is invisible
   to everything else.

## 2. Design

### 2.1 `utils/dupr-client.ts` — one shared client (the chokepoint)

```ts
// ---- session ----
getDuprToken(): Promise<string>
//   Logs in ONCE per process (memoized). Always uses the browser-header form
//   (Origin/Referer/UA) — the only one that reliably works. Kills the 4 copies.
//   Picks ONE User-Agent per process and keeps it for the session.

// ---- metered request primitives (all DUPR endpoints live here) ----
duprSearch(query: string): Promise<DuprSearchHit[]>
duprHistoryPage(numericId: number, offset: number): Promise<{hits, total}>
duprProfile(numericId: number): Promise<DuprProfile>   // task #31 slots in here

// ---- internals ----
meteredFetch(path, init):
//   1. await budget.take()        — global daily budget (2.2); throws BudgetExhausted
//   2. await humanPace()          — ONE pacing impl (2–5s, 12% long pause)
//   3. duprFetch(...)             — existing proxy wrapper, unchanged
//   4. on 429/403: backoff 25–90s, max 2 retries; after 3 consecutive failures
//      across the session → circuit-break: abort the whole run + Discord alert.
//      (Today each caller keeps poking after giving up per-player.)
```

Callers never touch `duprFetch`, headers, sleeps, or login again. New endpoints
(profile for #31) are one function here, automatically metered.

### 2.2 Global daily budget (DB-backed, ~20 lines)

Per-run caps don't compose — jobs can't see each other, and manual runs count for
nothing. One tiny table makes the ceiling real:

```sql
CREATE TABLE dupr_request_log (
  day date PRIMARY KEY,
  requests int NOT NULL DEFAULT 0
);
CREATE FUNCTION take_dupr_budget(n int) RETURNS int ...
  -- upsert today's row, requests += n, return new total
```

`meteredFetch` calls `take_dupr_budget(1)` before each request and compares to
`DUPR_DAILY_CEILING` (env, default **1500**). At the ceiling it raises
`BudgetExhausted`; batch runs catch it and end **gracefully** (stop pulling more
players, log what's left, exit 0). At 80% it posts one Discord warning.

Why 1500: with pacing at ~3–4s/request, 1500/day ≈ 90 minutes of sustained activity —
plausible for a heavy human user, and comfortably above current normal usage
(~600–900/day once the numeric-id cache lands). One row per day doubles as free
observability (requests/day trend on /admin).

Reserved headroom: on-demand `pull-player` (a few requests) always runs even past the
soft ceiling — it's user-facing; a hard cap at ceiling+50 protects against runaway.

### 2.3 One pull, one queue

**Cache the numeric id.** Add `players.dupr_numeric_id bigint`. Resolve it once
(first pull), reuse forever. Cuts ~⅓ of repeat-pull request volume immediately.

**Unify the per-player pull.** `pullPlayer(player)` = profile (ratings +
verified/provisional — this IS task #31) + history pages. Stamps `dupr_last_checked`
AND `matches_last_checked` together. The search-based ratings refresh
(`enrichDuprRatings`) shrinks to its real job: **discovery** — name-searching players
who have no `dupr_id` yet. Refresh and discovery become separate pipelines with
separate (small) budgets.

**One queue RPC** — `get_dupr_pull_queue(lim)`, an evolution of migration 031:

```
priority 1: rostered in active/recent tournament AND competed since last pull
priority 2: rostered, never pulled
priority 3: rostered, ratings/matches stale (>7d)
priority 4: everyone else by staleness
(all gated by the 24h fresh floor)
```

Every scheduled job drains the SAME queue, differing only in cap:
urgent-refresh hourly (cap 12) · enrich-matches 2×/day (cap 30) · scrape.yml's DUPR
section becomes just another drain (or gets deleted once enrich-matches covers it).
The backfill CLIs become thin wrappers over `pullPlayer` — budgeted and paced for free.

### 2.4 Workflow hygiene (free, do first)

Add scrape.yml to the `urgent-refresh` concurrency group (rename the group `dupr`).
Serializes all DUPR-touching jobs — one request stream, one identity, no interleaving.
Costs nothing at current scale.

## 3. Migration path (each step independently shippable)

1. **Shared client** — create `dupr-client.ts`; port the 4 logins + 3 pacing copies.
   Fixes the flaky bare logins. Zero behavior change otherwise. *(+ concurrency group)*
2. **Numeric-id cache + profile endpoint** — `dupr_numeric_id` column; `pullPlayer`
   gains the profile call → verified/provisional becomes real (**closes task #31**)
   and ratings refresh rides along with history.
3. **Global budget** — `dupr_request_log` + `take_dupr_budget`; meteredFetch enforces;
   Discord at 80%.
4. **Unified queue** — `get_dupr_pull_queue` replaces the 031 RPC +
   `getPlayersNeedingMatches` + the with-id half of `getStalePlayers`; scrape.yml's
   DUPR section collapses.

Steps 1–2 are the bulk of the value (reliability + ~⅓ request reduction + task #31).
Steps 3–4 make the ceiling and the freshness ordering global. No persistent queue,
no worker, no new infra beyond two tiny tables/RPCs.

## 4. What we deliberately skip (pre-launch scope)

- Persistent job queue / dedicated worker — GitHub Actions cron + caps is fine at this volume.
- Token refresh handling — runs are <25 min; one login per run is plenty.
- Multi-proxy rotation — one residential identity behaving consistently beats several behaving oddly.
- Per-endpoint budgets — one global number is enough until volume grows 5–10×.
