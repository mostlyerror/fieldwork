# PickleRadar Redesign + Player Intel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign tournament detail/list pages for better hierarchy and surfaced intelligence, then build a match history pipeline to power deep player profile pages.

**Architecture:** Phase 1 restructures existing components (no new data). Phase 2 adds a `matches` table, a match history scraper that extends the existing DUPR enrichment, and new query/component layers for player profiles. All DUPR API interaction follows the existing humanized-timing pattern in `dupr-enrichment.ts`.

**Tech Stack:** Next.js 15 (App Router, RSC), Supabase (Postgres + JS client), Tailwind CSS, TypeScript, tsx runner for scrapers.

---

## File Map

### Phase 1 — Visual Redesign
| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/components/tournament-detail.tsx` | Rewrite | Remove sidebar, vertical flow with stat cards + CTA row |
| `apps/web/src/app/[city]/tournaments/[id]/page.tsx` | Modify | Remove sidebar grid, restructure sections |
| `apps/web/src/components/tournament-card.tsx` | Rewrite | Add green intel footer bar, reorganize info |
| `apps/web/src/components/field-intel-section.tsx` | Create | Green branded header wrapping FieldIntelSummary + EventBreakdown |

### Phase 2 — Match History Pipeline + Deep Player Profiles
| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/014_matches_table.sql` | Create | Matches table + indexes |
| `packages/scrapers/src/utils/match-history.ts` | Create | Fetch + upsert match history from DUPR API |
| `packages/scrapers/src/index.ts` | Modify | Wire match history after enrichment |
| `packages/scrapers/src/enrich-dupr.ts` | Modify | Add standalone match history script |
| `apps/web/src/lib/types.ts` | Modify | Add Match, PlayerRecord, FrequentPartner types |
| `apps/web/src/lib/queries.ts` | Modify | Add getPlayerRecord, getFrequentPartners, getPlayerMatches, getPlayerUpcomingTournaments |
| `apps/web/src/app/players/[id]/page.tsx` | Rewrite | Deep intel layout with record, partners, matches, tournaments |
| `apps/web/src/components/intel-section-header.tsx` | Create | Reusable green branded section header |

---

## Phase 1: Visual Redesign

### Task 1: Reusable Intel Section Header

**Files:**
- Create: `apps/web/src/components/intel-section-header.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/intel-section-header.tsx
export function IntelSectionHeader({
  title,
  badge,
}: {
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-t-xl bg-[#065f46] px-4 py-2.5 text-white">
      <span className="text-xs font-bold uppercase tracking-widest">{title}</span>
      {badge && (
        <span className="text-[11px] opacity-70">{badge}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/intel-section-header.tsx
git commit -m "Add reusable IntelSectionHeader component"
```

---

### Task 2: Redesign Tournament Detail Page

**Files:**
- Rewrite: `apps/web/src/components/tournament-detail.tsx`
- Modify: `apps/web/src/app/[city]/tournaments/[id]/page.tsx`

- [ ] **Step 1: Rewrite tournament-detail.tsx — remove sidebar, add stat cards + CTA row**

Replace the entire component. New structure: title → subtitle → stat cards row → register CTA + utility buttons. No 2-column grid.

```tsx
// apps/web/src/components/tournament-detail.tsx
import type { Tournament, TournamentSource } from "@/lib/types";
import { formatDateRange, formatCurrency, relativeDate, googleMapsUrl } from "@/lib/format";
import { googleCalendarUrl, icsDataUrl } from "@/lib/calendar";
import { SOURCE_DISPLAY_NAMES } from "@/lib/constants";
import { ShareButtons } from "./share-buttons";

export function TournamentDetail({
  tournament,
  sources,
}: {
  tournament: Tournament;
  sources: TournamentSource[];
}) {
  const status = tournament.registration_status ?? "open";
  const withUrl = sources.filter((s) => s.registration_url);
  const relative = relativeDate(tournament.date_start);
  const mapsUrl = googleMapsUrl({
    latitude: tournament.latitude,
    longitude: tournament.longitude,
    address: tournament.location_address,
    name: tournament.location_name,
  });

  const hasSandbagger = (tournament.max_sandbagger_pct ?? 0) > 0.2;
  const sandbaggerCount = tournament.max_sandbagger_pct != null && tournament.max_sandbagger_pct > 0.2
    ? Math.round(tournament.max_sandbagger_pct * (tournament.event_count ?? 0))
    : 0;

  return (
    <>
      {/* Title + subtitle */}
      <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
        {tournament.name}
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        {formatDateRange(tournament.date_start, tournament.date_end)}
        {" · "}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 hover:underline">
          {tournament.location_name}
        </a>
        {relative && (
          <span className="ml-2 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
            {relative}
          </span>
        )}
      </p>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tournament.entry_fee != null && (
          <div className="rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Entry</p>
            <p className="text-xl font-extrabold text-emerald-600">{formatCurrency(tournament.entry_fee)}</p>
          </div>
        )}
        {(tournament.total_registered ?? 0) > 0 && (
          <div className="rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Registered</p>
            <p className="text-xl font-extrabold text-gray-900">{tournament.total_registered}</p>
          </div>
        )}
        {(tournament.event_count ?? 0) > 0 && (
          <div className="rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Events</p>
            <p className="text-xl font-extrabold text-gray-900">{tournament.event_count}</p>
          </div>
        )}
        {hasSandbagger && (
          <div className="rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-red-200">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500">⚠️ Alerts</p>
            <p className="text-xl font-extrabold text-red-600">{sandbaggerCount}</p>
          </div>
        )}
      </div>

      {/* Register CTA + utility buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {withUrl.map((source) => (
          <a
            key={source.id}
            href={source.registration_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl bg-emerald-600 px-6 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Register on {SOURCE_DISPLAY_NAMES[source.source_platform] ?? source.source_platform} ↗
          </a>
        ))}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-600 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
        >
          📍 Map
        </a>
        <a
          href={googleCalendarUrl(tournament)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-600 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
        >
          📅 Cal
        </a>
        <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200">
          <ShareButtons tournamentId={tournament.id} />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Update page.tsx — remove sidebar grid, restructure sections**

In `apps/web/src/app/[city]/tournaments/[id]/page.tsx`, update the main section. Remove MiniMapWrapper import and the sidebar grid. The page now flows: TournamentDetail → FieldIntelSummary + EventBreakdown (wrapped in intel section) → related tournaments.

Replace the `<main>` content (lines ~143–198) with:

```tsx
<main className="mx-auto max-w-3xl px-5 py-8">
  <Link
    href={`/${citySlug}`}
    className="mb-6 inline-flex items-center text-sm text-gray-400 hover:text-emerald-700"
  >
    &larr; Back to tournaments
  </Link>

  <TournamentDetail tournament={tournament} sources={sources} />

  {events.length > 0 && (
    <section className="mt-8 space-y-6">
      <FieldIntelSummary events={events} />
      <EventBreakdown events={events} />
    </section>
  )}

  {related.length > 0 && (
    <section className="mt-12">
      <h2 className="mb-4 text-lg font-bold text-gray-800">
        More Upcoming Tournaments
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((t) => (
          <TournamentCard key={t.id} tournament={t} citySlug={citySlug} />
        ))}
      </div>
    </section>
  )}

  <div className="mt-12 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-5 text-center">
    <p className="text-sm text-gray-500">
      Something missing or incorrect?{" "}
      <Link href="/submit" className="font-medium text-emerald-600 hover:text-emerald-700">Let us know</Link>
    </p>
  </div>
</main>
```

Remove the `MiniMapWrapper` import and the `miniMap` variable/prop. Remove `miniMap` from TournamentDetail props. Change max-width from `max-w-5xl` to `max-w-3xl`.

- [ ] **Step 3: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Visual check — load a tournament detail page in browser**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/houston/tournaments/1e0ecfb4-958c-4d80-b8d0-b83f4db216b4`
Expected: 200

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/tournament-detail.tsx "apps/web/src/app/[city]/tournaments/[id]/page.tsx"
git commit -m "Redesign tournament detail: remove sidebar, add stat cards and CTA row"
```

---

### Task 3: Redesign Tournament List Cards

**Files:**
- Rewrite: `apps/web/src/components/tournament-card.tsx`

- [ ] **Step 1: Rewrite tournament-card.tsx with intel footer bar**

```tsx
// apps/web/src/components/tournament-card.tsx
import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { FieldStrengthBadge } from "./field-strength-badge";

export function TournamentCard({
  tournament: t,
  citySlug,
}: {
  tournament: Tournament;
  citySlug?: string;
}) {
  const slug = citySlug ?? "houston";
  const hasIntel = (t.total_registered ?? 0) > 0 && t.avg_field_strength != null;
  const hasSandbagger = (t.max_sandbagger_pct ?? 0) > 0.2;

  // Count live DUPR ratings (from event-level data attached by attachIntelligenceAggregates)
  // For now use total_registered as proxy — live count needs a new aggregate
  const liveCount = hasIntel ? Math.round((t.total_registered ?? 0) * 0.53) : 0;

  return (
    <Link
      href={`/${slug}/tournaments/${t.id}`}
      className="group block overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:shadow-md hover:ring-emerald-200"
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-emerald-600">
              {formatDateRange(t.date_start, t.date_end)}
              {(t.event_count ?? 0) > 0 && (
                <span className="text-gray-400"> · {t.event_count} events</span>
              )}
            </p>
            <h3 className="mt-1 truncate text-base font-extrabold text-gray-900 group-hover:text-emerald-700">
              {t.name}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">{t.location_name}</p>
          </div>
          {t.entry_fee != null && (
            <p className="ml-3 flex-shrink-0 text-lg font-extrabold text-emerald-600">
              {formatCurrency(t.entry_fee)}
            </p>
          )}
        </div>

        {/* Badge row */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(t.total_registered ?? 0) > 0 && (
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              {t.total_registered} registered
            </span>
          )}
          {hasSandbagger && (
            <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              ⚠️ sandbagger alert
            </span>
          )}
          <FieldStrengthBadge
            avgFieldStrength={t.avg_field_strength}
            maxSandbaggerPct={t.max_sandbagger_pct}
          />
        </div>
      </div>

      {/* Green intel footer — only when we have data */}
      {hasIntel && liveCount > 0 && (
        <div className="flex items-center justify-between bg-[#065f46] px-4 py-2 text-[11px] text-white">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <strong>{liveCount}</strong> live DUPR ratings
          </span>
          <span className="opacity-60">View intel →</span>
        </div>
      )}
    </Link>
  );
}
```

Note: The `liveCount` is approximated for now. In a follow-up, we can add `total_live_dupr` to the intelligence aggregates query in `queries.ts`. This is a display-only approximation that doesn't block the redesign.

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Visual check — load homepage**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/houston`
Expected: 200

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tournament-card.tsx
git commit -m "Redesign tournament cards with intel footer bar"
```

---

### Task 4: Add Live DUPR Count to Intelligence Aggregates

**Files:**
- Modify: `apps/web/src/lib/queries.ts`
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/components/tournament-card.tsx`

- [ ] **Step 1: Add `total_live_dupr` to Tournament type**

In `apps/web/src/lib/types.ts`, add to the Tournament interface after `max_sandbagger_pct`:

```ts
total_live_dupr?: number;
```

- [ ] **Step 2: Compute live DUPR count in `attachIntelligenceAggregates`**

In `apps/web/src/lib/queries.ts`, the `attachIntelligenceAggregates` function currently queries `tournament_events` for field_strength and sandbagger data. We need a second query to count verified live DUPR players per tournament.

After the existing events query block (around line 135-160), add before the `return tournaments.map(...)`:

```ts
// Count live (verified) DUPR players per tournament
const { data: liveCounts } = await supabase
  .from("event_players")
  .select("tournament_events!inner(tournament_id), player_id, players!event_players_player_id_fkey(dupr_verified)")
  .in("tournament_events.tournament_id", ids)
  .not("player_id", "is", null);

const liveByTournament = new Map<string, number>();
for (const row of (liveCounts ?? [])) {
  const tid = (row as any).tournament_events?.tournament_id as string;
  const verified = (row as any).players?.dupr_verified === true;
  if (tid && verified) {
    liveByTournament.set(tid, (liveByTournament.get(tid) ?? 0) + 1);
  }
}
```

Then in the return mapping, add `total_live_dupr`:

```ts
total_live_dupr: liveByTournament.get(t.id) ?? 0,
```

- [ ] **Step 3: Use real count in tournament-card.tsx**

Replace the approximation line:
```ts
const liveCount = hasIntel ? Math.round((t.total_registered ?? 0) * 0.53) : 0;
```
With:
```ts
const liveCount = t.total_live_dupr ?? 0;
```

- [ ] **Step 4: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/queries.ts apps/web/src/components/tournament-card.tsx
git commit -m "Add live DUPR count to tournament intelligence aggregates"
```

---

## Phase 2: Match History Pipeline + Deep Player Profiles

### Task 5: Matches Table Migration

**Files:**
- Create: `supabase/migrations/014_matches_table.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Match history from DUPR API
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dupr_match_id BIGINT UNIQUE NOT NULL,
  event_date DATE NOT NULL,
  event_format TEXT NOT NULL,
  league TEXT,
  venue TEXT,

  team1_player1_id UUID REFERENCES players(id),
  team1_player2_id UUID REFERENCES players(id),
  team1_player1_name TEXT NOT NULL,
  team1_player2_name TEXT,

  team2_player1_id UUID REFERENCES players(id),
  team2_player2_id UUID REFERENCES players(id),
  team2_player1_name TEXT NOT NULL,
  team2_player2_name TEXT,

  game1_team1 SMALLINT,
  game1_team2 SMALLINT,
  game2_team1 SMALLINT,
  game2_team2 SMALLINT,
  game3_team1 SMALLINT,
  game3_team2 SMALLINT,

  team1_won BOOLEAN NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_t1p1 ON matches (team1_player1_id);
CREATE INDEX idx_matches_t1p2 ON matches (team1_player2_id);
CREATE INDEX idx_matches_t2p1 ON matches (team2_player1_id);
CREATE INDEX idx_matches_t2p2 ON matches (team2_player2_id);
CREATE INDEX idx_matches_date ON matches (event_date DESC);

-- Track when we last fetched match history per player
ALTER TABLE players ADD COLUMN IF NOT EXISTS matches_last_checked TIMESTAMPTZ;

-- Public read access for match data
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY matches_public_read ON matches FOR SELECT USING (true);
```

- [ ] **Step 2: Push migration**

Run: `supabase db push`
Expected: Migration 014 applied successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/014_matches_table.sql
git commit -m "Add matches table for DUPR match history"
```

---

### Task 6: Match History Scraper

**Files:**
- Create: `packages/scrapers/src/utils/match-history.ts`
- Modify: `packages/scrapers/src/index.ts`
- Create: `packages/scrapers/src/enrich-matches.ts`

- [ ] **Step 1: Create match-history.ts**

This module fetches match history from DUPR for players with a `dupr_id`, then upserts into the `matches` table. It reuses the auth + timing patterns from `dupr-enrichment.ts`.

```ts
// packages/scrapers/src/utils/match-history.ts
import { supabase } from "./supabase.js";

const DUPR_API_BASE = "https://api.dupr.gg";
const BATCH_SIZE = 30;
const STALE_DAYS = 7;

// Re-use timing helpers from enrichment
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function randBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}
function humanDelay(): number {
  if (Math.random() < 0.12) return randBetween(8000, 18000);
  const a = randBetween(2000, 5000);
  const b = randBetween(2000, 5000);
  return Math.floor((a + b) / 2);
}

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
];

function apiHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Authorization": `Bearer ${token}`,
  };
}

interface DuprMatch {
  matchId: number;
  eventDate: string;
  eventFormat: string;
  league?: string;
  venue?: string;
  teams: Array<{
    serial: number;
    player1: { id: number; fullName: string; duprId?: string };
    player2?: { id: number; fullName: string; duprId?: string };
    game1: number; game2: number; game3: number;
    game4: number; game5: number;
    winner: boolean;
  }>;
}

async function fetchMatchHistory(
  duprPlayerId: number,
  token: string,
): Promise<DuprMatch[]> {
  const res = await fetch(`${DUPR_API_BASE}/player/v1.0/${duprPlayerId}/history`, {
    method: "POST",
    headers: apiHeaders(token),
    body: JSON.stringify({
      filters: {},
      sort: { order: "DESC", parameter: "MATCH_DATE" },
      limit: 50,
      offset: 0,
    }),
  });

  if (res.status === 429) {
    console.warn("[match-history] Rate limited, backing off...");
    await sleep(randBetween(25000, 90000));
    return [];
  }

  if (!res.ok) {
    console.error(`[match-history] Fetch failed: ${res.status}`);
    return [];
  }

  const data = await res.json();
  return data.result?.hits ?? [];
}

async function resolvePlayerId(duprId: string | undefined): Promise<string | null> {
  if (!duprId) return null;
  const { data } = await supabase
    .from("players")
    .select("id")
    .eq("dupr_id", duprId)
    .maybeSingle();
  return data?.id ?? null;
}

async function upsertMatches(matches: DuprMatch[]): Promise<number> {
  let inserted = 0;

  for (const m of matches) {
    if (m.teams.length < 2) continue;
    const t1 = m.teams.find((t) => t.serial === 1) ?? m.teams[0];
    const t2 = m.teams.find((t) => t.serial === 2) ?? m.teams[1];

    const row = {
      dupr_match_id: m.matchId,
      event_date: m.eventDate,
      event_format: m.eventFormat,
      league: m.league ?? null,
      venue: m.venue ?? null,
      team1_player1_id: await resolvePlayerId(t1.player1?.duprId),
      team1_player2_id: await resolvePlayerId(t1.player2?.duprId),
      team1_player1_name: t1.player1?.fullName ?? "Unknown",
      team1_player2_name: t1.player2?.fullName ?? null,
      team2_player1_id: await resolvePlayerId(t2.player1?.duprId),
      team2_player2_id: await resolvePlayerId(t2.player2?.duprId),
      team2_player1_name: t2.player1?.fullName ?? "Unknown",
      team2_player2_name: t2.player2?.fullName ?? null,
      game1_team1: t1.game1 >= 0 ? t1.game1 : null,
      game1_team2: t2.game1 >= 0 ? t2.game1 : null,
      game2_team1: t1.game2 >= 0 ? t1.game2 : null,
      game2_team2: t2.game2 >= 0 ? t2.game2 : null,
      game3_team1: t1.game3 >= 0 ? t1.game3 : null,
      game3_team2: t2.game3 >= 0 ? t2.game3 : null,
      team1_won: t1.winner,
    };

    const { error } = await supabase
      .from("matches")
      .upsert(row, { onConflict: "dupr_match_id" });

    if (error) {
      console.error(`[match-history] Upsert error for match ${m.matchId}:`, error.message);
    } else {
      inserted++;
    }
  }
  return inserted;
}

interface PlayerToFetch {
  id: string;
  name: string;
  dupr_id: string;
}

async function getPlayersNeedingMatches(limit: number): Promise<PlayerToFetch[]> {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - STALE_DAYS);

  const { data, error } = await supabase
    .from("players")
    .select("id, name, dupr_id")
    .not("dupr_id", "is", null)
    .eq("dupr_verified", true)
    .or(`matches_last_checked.is.null,matches_last_checked.lt.${staleDate.toISOString()}`)
    .order("matches_last_checked", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error("[match-history] Error fetching players:", error);
    return [];
  }

  return (data ?? []).filter((p): p is PlayerToFetch => p.dupr_id != null);
}

export async function fetchAllMatchHistory(token: string): Promise<{
  playersChecked: number;
  matchesInserted: number;
}> {
  console.log("[match-history] Starting match history fetch...");

  const players = await getPlayersNeedingMatches(BATCH_SIZE);
  console.log(`[match-history] ${players.length} players need match history`);

  let totalInserted = 0;

  for (const player of players) {
    // DUPR API uses numeric ID, but we search by duprId (alphanumeric)
    // The search endpoint returns the numeric id — we need to look it up
    const searchRes = await fetch(`${DUPR_API_BASE}/player/v1.0/search`, {
      method: "POST",
      headers: apiHeaders(token),
      body: JSON.stringify({
        query: player.dupr_id,
        limit: 1,
        offset: 0,
        includeUnclaimedPlayers: true,
        filter: {},
      }),
    });

    if (!searchRes.ok) {
      console.error(`[match-history] Search failed for ${player.name}`);
      await sleep(humanDelay());
      continue;
    }

    const searchData = await searchRes.json();
    const duprNumericId = searchData.result?.hits?.[0]?.id;

    if (!duprNumericId) {
      await supabase.from("players").update({ matches_last_checked: new Date().toISOString() }).eq("id", player.id);
      await sleep(humanDelay());
      continue;
    }

    await sleep(humanDelay());

    const matches = await fetchMatchHistory(duprNumericId, token);
    const inserted = await upsertMatches(matches);
    totalInserted += inserted;

    await supabase
      .from("players")
      .update({ matches_last_checked: new Date().toISOString() })
      .eq("id", player.id);

    console.log(`[match-history] ${player.name}: ${matches.length} matches, ${inserted} upserted`);
    await sleep(humanDelay());
  }

  console.log(`[match-history] Done. Players: ${players.length}, Matches inserted: ${totalInserted}`);
  return { playersChecked: players.length, matchesInserted: totalInserted };
}
```

- [ ] **Step 2: Create standalone entry point**

```ts
// packages/scrapers/src/enrich-matches.ts
import { enrichDuprRatings } from "./utils/dupr-enrichment.js";
import { fetchAllMatchHistory } from "./utils/match-history.js";

async function main() {
  console.log("Match History Fetch — standalone run");
  console.log("=".repeat(40));

  // Need to authenticate first — reuse enrichment's auth
  const email = process.env.DUPR_EMAIL;
  const password = process.env.DUPR_PASSWORD;
  if (!email || !password) {
    console.error("Missing DUPR_EMAIL or DUPR_PASSWORD");
    process.exit(1);
  }

  const res = await fetch("https://api.dupr.gg/auth/v1.0/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (data.status !== "SUCCESS") {
    console.error("Auth failed");
    process.exit(1);
  }

  const result = await fetchAllMatchHistory(data.result.accessToken);
  console.log("\nSummary:");
  console.log(`  Players checked: ${result.playersChecked}`);
  console.log(`  Matches inserted: ${result.matchesInserted}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
```

- [ ] **Step 3: Add npm script to package.json**

In `packages/scrapers/package.json`, add:
```json
"enrich:matches": "tsx src/enrich-matches.ts"
```

- [ ] **Step 4: Wire into main scraper runner**

In `packages/scrapers/src/index.ts`, import `fetchAllMatchHistory` and add after the DUPR enrichment block:

```ts
import { fetchAllMatchHistory } from "./utils/match-history.js";
```

Then after the enrichment `try/catch` block, add:

```ts
// Match history: fetch recent matches for verified players
try {
  const matchResult = await fetchAllMatchHistory(auth.accessToken);
  if (matchResult.matchesInserted > 0) {
    await sendDiscordAlert({
      title: "📋 Match History Updated",
      description: `Checked ${matchResult.playersChecked} players, inserted ${matchResult.matchesInserted} matches`,
      color: 0x22c55e,
    });
  }
} catch (err) {
  console.error("[match-history] Match history step failed:", err);
}
```

Note: This reuses the `auth` token from the enrichment step. The match history call must be inside the `if (process.env.DUPR_EMAIL && process.env.DUPR_PASSWORD)` block, after enrichment.

- [ ] **Step 5: Type-check**

Run: `cd packages/scrapers && npx tsc --noEmit --skipLibCheck`
Expected: No errors (ignore pre-existing capture-snapshot error)

- [ ] **Step 6: Commit**

```bash
git add packages/scrapers/src/utils/match-history.ts packages/scrapers/src/enrich-matches.ts packages/scrapers/package.json packages/scrapers/src/index.ts
git commit -m "Add match history scraper from DUPR API"
```

---

### Task 7: Player Profile Queries

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/queries.ts`

- [ ] **Step 1: Add types for match data**

In `apps/web/src/lib/types.ts`, add:

```ts
export interface Match {
  id: string;
  event_date: string;
  event_format: string;
  league: string | null;
  team1_player1_name: string;
  team1_player2_name: string | null;
  team2_player1_name: string;
  team2_player2_name: string | null;
  team1_player1_id: string | null;
  team1_player2_id: string | null;
  team2_player1_id: string | null;
  team2_player2_id: string | null;
  game1_team1: number | null;
  game1_team2: number | null;
  game2_team1: number | null;
  game2_team2: number | null;
  game3_team1: number | null;
  game3_team2: number | null;
  team1_won: boolean;
}

export interface PlayerRecord {
  format: string;
  wins: number;
  losses: number;
}

export interface FrequentPartner {
  playerId: string | null;
  name: string;
  matchCount: number;
  wins: number;
  losses: number;
}
```

- [ ] **Step 2: Add query functions**

In `apps/web/src/lib/queries.ts`, add:

```ts
export async function getPlayerMatches(
  playerId: string,
  limit = 20,
): Promise<Match[]> {
  // Player could be in any of the 4 player slots
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .or(`team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`)
    .order("event_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching player matches:", error);
    return [];
  }
  return (data ?? []) as Match[];
}

export function computePlayerRecord(matches: Match[], playerId: string): PlayerRecord[] {
  const byFormat = new Map<string, { wins: number; losses: number }>();

  for (const m of matches) {
    const onTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId;
    const won = onTeam1 ? m.team1_won : !m.team1_won;
    const format = m.event_format;

    if (!byFormat.has(format)) byFormat.set(format, { wins: 0, losses: 0 });
    const rec = byFormat.get(format)!;
    if (won) rec.wins++; else rec.losses++;
  }

  return Array.from(byFormat.entries()).map(([format, rec]) => ({
    format,
    wins: rec.wins,
    losses: rec.losses,
  }));
}

export function computeFrequentPartners(matches: Match[], playerId: string): FrequentPartner[] {
  const partners = new Map<string, { id: string | null; name: string; wins: number; losses: number; count: number }>();

  for (const m of matches) {
    const onTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId;
    const won = onTeam1 ? m.team1_won : !m.team1_won;

    let partnerName: string | null = null;
    let partnerId: string | null = null;

    if (onTeam1) {
      if (m.team1_player1_id === playerId) {
        partnerName = m.team1_player2_name;
        partnerId = m.team1_player2_id;
      } else {
        partnerName = m.team1_player1_name;
        partnerId = m.team1_player1_id;
      }
    } else {
      if (m.team2_player1_id === playerId) {
        partnerName = m.team2_player2_name;
        partnerId = m.team2_player2_id;
      } else {
        partnerName = m.team2_player1_name;
        partnerId = m.team2_player1_id;
      }
    }

    if (!partnerName) continue;

    const key = partnerName.toLowerCase();
    if (!partners.has(key)) {
      partners.set(key, { id: partnerId, name: partnerName, wins: 0, losses: 0, count: 0 });
    }
    const p = partners.get(key)!;
    p.count++;
    if (won) p.wins++; else p.losses++;
    if (partnerId) p.id = partnerId;
  }

  return Array.from(partners.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((p) => ({ playerId: p.id, name: p.name, matchCount: p.count, wins: p.wins, losses: p.losses }));
}

export async function getPlayerUpcomingTournaments(playerId: string): Promise<{
  tournamentId: string;
  tournamentName: string;
  dateStart: string;
  eventName: string;
  listedDupr: number | null;
}[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("event_players")
    .select(`
      dupr_rating,
      tournament_events!inner (
        name,
        tournament_id,
        tournaments!inner (id, name, date_start)
      )
    `)
    .eq("player_id", playerId)
    .gte("tournament_events.tournaments.date_start", today);

  if (error || !data) return [];

  return data.map((row: any) => ({
    tournamentId: row.tournament_events.tournaments.id,
    tournamentName: row.tournament_events.tournaments.name,
    dateStart: row.tournament_events.tournaments.date_start,
    eventName: row.tournament_events.name,
    listedDupr: row.dupr_rating,
  }));
}
```

- [ ] **Step 3: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/queries.ts
git commit -m "Add player match history queries and record computation"
```

---

### Task 8: Deep Player Profile Page

**Files:**
- Rewrite: `apps/web/src/app/players/[id]/page.tsx`

- [ ] **Step 1: Rewrite player profile with deep intel**

```tsx
// apps/web/src/app/players/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getPlayer,
  getPlayerMatches,
  getPlayerUpcomingTournaments,
  computePlayerRecord,
  computeFrequentPartners,
} from "@/lib/queries";
import { ServerHeader } from "@/components/server-header";
import { IntelSectionHeader } from "@/components/intel-section-header";
import { getDefaultCity } from "@/lib/cities";
import type { Match } from "@/lib/types";

export const revalidate = 600;

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) return { title: "Player Not Found" };

  const duprStr = player.dupr_doubles != null ? ` — DUPR ${player.dupr_doubles.toFixed(2)}` : "";
  return {
    title: `${player.name}${duprStr} — PickleRadar`,
    description: `View ${player.name}'s match record, frequent partners, and tournament history on PickleRadar.`,
  };
}

function formatRecord(wins: number, losses: number) {
  const total = wins + losses;
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
  return { wins, losses, pct };
}

function formatFormat(f: string): string {
  if (f === "DOUBLES") return "Doubles";
  if (f === "SINGLES") return "Singles";
  if (f === "MIXED_DOUBLES") return "Mixed";
  return f;
}

function GameScores({ match, onTeam1 }: { match: Match; onTeam1: boolean }) {
  const games: [number | null, number | null][] = [
    [match.game1_team1, match.game1_team2],
    [match.game2_team1, match.game2_team2],
    [match.game3_team1, match.game3_team2],
  ];

  return (
    <div className="flex flex-col items-end gap-0.5">
      {games.map(([s1, s2], i) => {
        if (s1 == null || s2 == null) return null;
        const myScore = onTeam1 ? s1 : s2;
        const theirScore = onTeam1 ? s2 : s1;
        return (
          <span key={i} className="text-sm font-bold text-gray-700">
            {myScore}-{theirScore}
          </span>
        );
      })}
    </div>
  );
}

export default async function PlayerPage({ params }: PageProps) {
  const { id } = await params;
  const [player, matches, upcoming] = await Promise.all([
    getPlayer(id),
    getPlayerMatches(id),
    getPlayerUpcomingTournaments(id),
  ]);

  if (!player) notFound();

  const city = getDefaultCity();
  const records = computePlayerRecord(matches, id);
  const partners = computeFrequentPartners(matches, id);

  const overallWins = records.reduce((s, r) => s + r.wins, 0);
  const overallLosses = records.reduce((s, r) => s + r.losses, 0);
  const overall = formatRecord(overallWins, overallLosses);

  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <ServerHeader city={city} />

      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link
          href={`/${city.slug}`}
          className="mb-6 inline-flex items-center text-sm text-gray-400 hover:text-emerald-700"
        >
          &larr; Back to tournaments
        </Link>

        {/* Player header */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">{player.name}</h1>
              {player.location && <p className="mt-1 text-sm text-gray-500">{player.location}</p>}
              {player.dupr_last_checked && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Updated {new Date(player.dupr_last_checked).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
            <div className="flex gap-5 text-center">
              {player.dupr_doubles != null && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Doubles</p>
                  <p className="text-3xl font-extrabold text-emerald-600">{player.dupr_doubles.toFixed(2)}</p>
                  {player.dupr_verified && (
                    <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600">Verified</span>
                  )}
                </div>
              )}
              {player.dupr_singles != null && (
                <div className="border-l border-gray-200 pl-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Singles</p>
                  <p className="text-3xl font-extrabold text-gray-700">{player.dupr_singles.toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Record breakdown */}
        {matches.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-100">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Overall</p>
              <p className="text-xl font-extrabold">{overall.wins}W-{overall.losses}L</p>
              <p className="text-xs text-gray-500">{overall.pct}% win rate</p>
            </div>
            {records.map((r) => {
              const rec = formatRecord(r.wins, r.losses);
              return (
                <div key={r.format} className="rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-100">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{formatFormat(r.format)}</p>
                  <p className="text-xl font-extrabold">{rec.wins}W-{rec.losses}L</p>
                  <p className="text-xs text-gray-500">{rec.pct}% win rate</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Frequent partners */}
        {partners.length > 0 && (
          <div className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Frequent Partners</h2>
            <div className="flex flex-wrap gap-3">
              {partners.map((p) => (
                <div key={p.name} className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    {p.playerId ? (
                      <Link href={`/players/${p.playerId}`} className="text-sm font-semibold text-emerald-700 hover:underline">{p.name}</Link>
                    ) : (
                      <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    )}
                    <p className="text-[10px] text-gray-500">{p.matchCount} matches · {p.wins}W-{p.losses}L</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent matches */}
        {matches.length > 0 && (
          <section className="mt-6">
            <IntelSectionHeader title="Recent Matches" badge={`${matches.length} matches`} />
            <div className="overflow-hidden rounded-b-xl border border-t-0 border-gray-100 bg-white">
              {matches.slice(0, 10).map((m) => {
                const onTeam1 = m.team1_player1_id === id || m.team1_player2_id === id;
                const won = onTeam1 ? m.team1_won : !m.team1_won;
                const partner = onTeam1
                  ? (m.team1_player1_id === id ? m.team1_player2_name : m.team1_player1_name)
                  : (m.team2_player1_id === id ? m.team2_player2_name : m.team2_player1_name);
                const opp1 = onTeam1 ? m.team2_player1_name : m.team1_player1_name;
                const opp2 = onTeam1 ? m.team2_player2_name : m.team1_player2_name;

                return (
                  <div key={m.id} className="border-b border-gray-50 px-4 py-3 last:border-b-0">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${won ? "bg-gray-100 text-gray-700" : "bg-gray-50 text-gray-400"}`}>
                            {won ? "W" : "L"}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {new Date(m.event_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {" · "}
                            {formatFormat(m.event_format)}
                          </span>
                        </div>
                        {m.league && (
                          <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{m.league}</p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-500">
                          {partner && <>w/ <span className="text-emerald-600">{partner}</span> vs </>}
                          {opp1}{opp2 ? ` + ${opp2}` : ""}
                        </p>
                      </div>
                      <GameScores match={m} onTeam1={onTeam1} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Upcoming tournaments */}
        {upcoming.length > 0 && (
          <section className="mt-6">
            <IntelSectionHeader title="Upcoming Tournaments" />
            <div className="overflow-hidden rounded-b-xl border border-t-0 border-gray-100 bg-white">
              {upcoming.map((t, i) => (
                <Link
                  key={`${t.tournamentId}-${t.eventName}-${i}`}
                  href={`/${city.slug}/tournaments/${t.tournamentId}`}
                  className="flex items-center justify-between border-b border-gray-50 px-4 py-3 transition hover:bg-gray-50 last:border-b-0"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{t.tournamentName}</p>
                    <p className="text-xs text-gray-500">{t.eventName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">
                      {new Date(t.dateStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                    {t.listedDupr != null && player.dupr_doubles != null && player.dupr_verified && Math.abs(player.dupr_doubles - t.listedDupr) > 0.05 && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 line-through">{t.listedDupr.toFixed(2)}</span>
                        <span className="text-sm font-bold text-emerald-600">{player.dupr_doubles.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {matches.length === 0 && upcoming.length === 0 && (
          <div className="mt-8 rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-gray-400">No match history or upcoming tournaments yet</p>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/players/[id]/page.tsx"
git commit -m "Rebuild player profile with deep intel: record, partners, matches, tournaments"
```

---

### Task 9: Integration Test — Run Match History Pipeline

- [ ] **Step 1: Push migration**

Run: `supabase db push`
Expected: Migration 014 applied

- [ ] **Step 2: Run match history for a small batch**

```bash
cd packages/scrapers
SUPABASE_URL=https://tzlvhijereszxvrcgzyt.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" ../../.env.local | cut -d= -f2-) \
DUPR_EMAIL=$(grep "^DUPR_EMAIL=" ../../.env.local | cut -d= -f2-) \
DUPR_PASSWORD=$(grep "^DUPR_PASSWORD=" ../../.env.local | cut -d= -f2-) \
npx tsx src/enrich-matches.ts
```

Expected: Players checked > 0, matches inserted > 0, no errors

- [ ] **Step 3: Verify data in Supabase**

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { count } = await sb.from('matches').select('*', { count: 'exact', head: true });
  console.log('Matches in DB:', count);
})();"
```

Expected: count > 0

- [ ] **Step 4: Load a player profile page with match data**

Start dev server, navigate to a player who was enriched. Verify: record cards show, recent matches render, no console errors.

- [ ] **Step 5: Commit all remaining changes and push**

```bash
git add -A
git commit -m "Wire match history pipeline end-to-end"
git push
```
