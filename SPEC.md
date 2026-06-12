# PickleRadar — Rebuild Spec

> **How to use this file.** This is a goals-and-invariants spec, written so a fresh Claude session can build the entire app from scratch in one pass. It captures *what the product must do and why*, not how the current codebase does it. Where the current implementation embodies a hard-won lesson, that lesson is stated as a constraint. Everything else — architecture, schema details, UI composition, library choices — you may reimagine freely. Section 11 lists what's fixed vs. what's yours to redesign.
>
> Supersedes `PICKLEUP_SPEC.md` (the original mobile-first vision; the product pivoted web-first). `docs/PRODUCT_STRATEGY.md` (2026-05) is still the live business strategy and is summarized in §2.

---

## 1. What PickleRadar Is

A local **tournament intelligence and distribution business** for pickleball — not just a directory. It aggregates every tournament in a metro area (launch city: Houston) into one place, then layers on intelligence no other site has: who's registered, how strong the field really is, player scouting profiles, results history.

**North star:** Houston players say "just check PickleRadar" instead of scrolling 5 sites and 3 Facebook groups.

**The problem:** Tournament discovery is fragmented across PickleballBrackets.com, PickleballTournaments.com, Pickleball Den, local club sites, and Facebook groups. No one aggregates. Registration windows fill fast; late discovery = missed tournaments. Houston has 70+ facilities and ~14k tournament-competitive players.

**The moat thesis ("grafting"):** Start by growing off scraped data, then convert that audience into first-party assets the sources can't take away — email subscribers, claimed player profiles, snapshotted rating/results history (be the "Zestimate" of player data), community submissions. Identity features are gated give-to-get (claim your profile to unlock). Snapshot history aggressively *now*; longitudinal data is the long-term moat and a prerequisite for features like a Spotify-Wrapped-style year in review.

---

## 2. Business Model & Priorities (context, not build targets)

Free tournament listings are the trust layer — never charge players to browse, never take a cut of registration fees. Revenue, in order:

1. **Tournament-director promotion** ($49 featured → $299/mo recurring): featured placement on site + digest + social push, with simple click reporting. First revenue; sellable manually with current infrastructure.
2. **Player premium (~$5/mo)**: advanced DUPR field intelligence, personalized "best events for your rating," instant alerts, watchlists.
3. **Facility sponsorship** ($200–500/mo): featured venue profiles, sponsored digest placement.

Success metrics: 700 Houston subscribers, ≥50% coverage of known Houston tournaments, ≥30% digest open rate, 3+ paid TD promotions.

**Current operating posture:** pre-launch, solo founder, *distribution > features*. The weekly loop (digest + tournament-pegged social posts where the field intel IS the content) matters more than new product surface. Completeness is the product — if players check PickleRadar and miss a real tournament, trust dies.

Explicitly deprioritized: native mobile app (web has all acquisition surfaces), partner matching (second marketplace before the first is proven), paid basic listings.

---

## 3. Users

- **Competitive players** (primary): find the right tournament before it fills; scout fields and opponents; track their own results and rating history.
- **Tournament directors / facilities** (revenue): fill brackets with the right local players.
- **The operator (Ben)**: needs an admin surface + Discord alerting to run scrapers, review submissions, monitor health, and drive the weekly distribution loop solo, cheaply.

---

## 4. Product Surface (must exist in some form; composition is flexible)

### Discovery
- **City pages** (`/houston` etc.) — the main feed. Upcoming tournaments, filterable (date, skill, distance, format, fee), list + map views, SEO-oriented. Geo-detect city, Houston default.
- **Tournament detail** — dates, venue, events/divisions, entry info, registration link out to the source, plus the intelligence layer: per-event field intel (see §7), live bracket/matches during play, podium results after. Custom OG images for sharing.
- **Venue pages** — deduplicated venue entities (Google Places–backed) with upcoming + recent tournaments, photo, cadence. SEO surface and future sponsorship inventory.
- **Search** — tournaments, players, venues.

### Player identity (the moat surface)
- **Player profiles** — persistent identity built from scraped rosters: DUPR rating + history chart, match record by format, frequent partners, head-to-head, recent results, badges, and a generated scouting blurb ("the Read").
- **Profile claiming** — a real user claims "their" scraped player via explicit verification (DUPR lookup + email token). Claiming is the give-to-get gate for premium identity features. (A passive auto-linker was tried and shelved; explicit claim is the path.)
- **Result cards** — standalone shareable pages + generated images (1080×1350) for a placement: medal, event, tournament. Built for players to post themselves — this is organic distribution.

### Accounts
- Email/password auth, profile with skill level, DUPR link, location + notification radius, favorites/saved tournaments.

### Community input
- **Manual tournament submission** — form with AI extraction from flyer images/URLs (Claude vision), venue geocoding, admin review queue. This is how Facebook-group and club tournaments get covered.

### Distribution
- **Weekly email digest** (Brevo) to a subscriber list: top upcoming tournaments, notable results. Unsubscribe page.
- **Social post queue** — generated digest/intel images queued for admin review, then posted (Instagram/Facebook). Captions respect a consent floor: aggregate stats fine; don't single out individuals unfavorably.
- **Discord webhooks** (operator-facing): new tournaments, scraper health/failures, placements recorded, enrichment summaries (aggregates, not per-player spam).

### Admin
- Dashboard: scraper run history + manual trigger, submission review, subscriber trend, social queue, health/attention banner, bulk flyer import.

---

## 5. Data Spine (concepts are fixed; schema design is yours)

Entities and relationships that must exist, whatever shape you give them:

- **Tournament** — name, date range, venue, skill levels, format, fee, registration URL, status, source platform + source URL. A tournament may be confirmed by **multiple sources** (keep a per-source record for dedup and resilience).
- **Venue** — deduplicated physical location (Google Place ID as anchor), slug, geo, city, photo.
- **Event** (division/bracket within a tournament) — type (singles/doubles/mixed), gender, skill cap range, team cap, registered count, computed field-intel aggregates.
- **EventPlayer** (roster row) — player name + partner, DUPR snapshot *at time of scrape*, links to Player records, placement.
- **Player** — persistent identity keyed on the source platform's player ID; name, location, gender, DUPR doubles/singles, claimed-by user.
- **Match** — live bracket matches (teams, scores, round, court, status) and enriched cross-tournament match history from DUPR.
- **RatingHistory** — append-only snapshots of player rating over time. Never overwrite ratings in place without snapshotting; history is the moat.
- **Placement** — podium finishes per event.
- **User**, **Favorite**, **EmailSubscriber**, **SocialPost** (queue with status lifecycle), **ScraperRun** (audit log: counts found/new/updated/deduped, errors).

Geo queries (distance from user, map) and fuzzy name search (trigram or equivalent) are required capabilities.

---

## 6. Pipelines (behavior + constraints are fixed; orchestration is yours)

### Sources
- **PickleballBrackets.com (PBB)** — primary. Playwright-scraped (JS-rendered). Tournaments, events, rosters, live brackets, podiums.
- **Pickleball Den** — secondary directory source.
- **DUPR** (via pickleball.com) — ratings + match history enrichment. Not a tournament source.
- Manual submissions + AI flyer extraction fill what scrapers can't reach.
- Architecture must make adding a source cheap (e.g., CourtReserve is a known candidate). Single-source dependence on PBB is a recognized existential risk — multi-source confirmation and raw-snapshot archiving are part of resilience.

### Flow
Scrape → change-detect (hash) → normalize → dedupe (name+date+location across sources) → upsert → enrich (DUPR ratings, venue/Places match, player linking) → compute field intel → alert (Discord).

### Hard-won pipeline rules (do not relearn these)
1. **Under the radar.** Keep scraping footprint low vs. PBB: modest cadence (≈2×/day full scrape, hourly only for live-tournament passes and urgent refreshes), mirror/proxy their images — **never hotlink**, no aggressive crawling. Don't advertise the source relationship.
2. **DUPR metered layer.** ALL DUPR access goes through one client module: single login session, request budget, queue, serialized concurrency group. Never inline DUPR fetches. DUPR blocks datacenter IPs — a residential proxy is required from CI. Enrichment is queue-drained in bounded batches (e.g., 30 players/run), not fan-out.
3. **Post-start scrapes must never wipe rosters.** Once a tournament starts, the source hides/changes registration data; treat empty roster responses as "no data," not "delete."
4. **Venue-local dates** for any date-windowed job — a tournament in Houston doesn't end at UTC midnight.
5. **Name matching** (rosters ↔ players ↔ podiums) needs normalization: strip Jr/Sr suffixes, fuzzy match with location as a tiebreaker; backfill missed medalists rather than assuming first-pass completeness.
6. **Tournament lifecycle:** `active` → (end date) → 30-day `grace` (results visible, less featured) → `archived` (auto, via scraper). `pending_review` for submissions. Don't hide a tournament the day after it ends — results traffic peaks then.
7. **Ordering matters in ingestion** — roster upserts racing match-history enrichment stranded data once (the "Cecilia" postmortem); the metered queue fixed it. Keep enrichment serialized behind ingestion.

### Jobs (current cadence — tune freely, keep intent)
Full scrape 2×/day; hourly live-match pass during active tournaments; hourly placements pass; hourly small urgent DUPR refresh; 2×/day match-history enrichment drain; weekly digest (Mon). All DUPR-touching jobs share one concurrency group. Every run logs to ScraperRun and alerts Discord on failure.

---

## 7. Intelligence Layer (the differentiator — keep the substance, reimagine presentation)

- **Field intel per event:** DUPR distribution histogram, average/strength tier, honesty signals, and **over-cap detection** (players rated above the event's skill cap). Public-facing language is "over cap" — never "sandbagger."
- **Phase 2 (designed, blocked on viewer gender+rating):** "are you eligible," "where would you percentile in this field."
- **Player Read:** generated scouting copy from match history (style, form, results). One classifier/fits engine should feed the Read, badges, and any narrative arc features — don't build three.
- **Badges:** rarity-tiered scouting-tell achievements from match history (clutch, rising, streaks…). Site-wide garnish that makes data pages fun.
- **Tone:** the site should feel fun and editorial, not a dry data table. Intelligence presented as one-line "quiet intel" insights beats raw stat dumps.

---

## 8. Design Language (fixed direction, free execution)

- **Warm editorial:** cream background (#FFFDF7-ish), near-black text, dark green/emerald accents, peach/amber secondary, bold display type (Plus Jakarta Sans), emerald-tinted card shadows — premium, not corporate-SaaS.
- **Mobile-first:** design at ~360px, enhance up. Mobile is the primary surface.
- **System, not ad-hoc:** role-based type scale (display/h1/h2/h3/body/small/caption/label as utility classes), shared shadow/spacing tokens. No one-off pixel font sizes. shadcn-style primitives + cva; no DaisyUI.
- **v2 patterns that work:** card-overlapping-hero layouts, uniform editorial fact rows, quiet one-line intel callouts, aligned button rows, no competing color bands. Tasteful motion (staggered fade-ups, playful micro-animations), `prefers-reduced-motion` respected.
- **Consistency:** the language applies to *every* page — admin, auth, error states — not just hero pages.
- Branding gap: no real logo yet (text wordmark). A proper mark is wanted.

---

## 9. Tech Stack (proven; substitute only with reason)

- **Web:** Next.js App Router on Vercel, ISR on hot pages, Tailwind v4 tokens-in-CSS.
- **DB/Auth:** Supabase Postgres (+ PostGIS-style geo, trigram search), Supabase Auth. ⚠️ Currently local dev points at prod — a rebuild should establish a separate dev database from day one.
- **Email:** Brevo **API** for transactional sends. Password reset = admin `generateLink` + Brevo send; Supabase SMTP proved flaky — don't re-debug it.
- **Scrapers:** Node + Playwright, scheduled via GitHub Actions (free tier), residential proxy for DUPR only.
- **AI:** Claude API for flyer extraction (vision) and generated copy.
- **Maps:** MapLibre GL. **Images:** Google Places photos (fetched/optimized at ingest), generated OG/result cards.
- **Analytics:** PostHog (proxied). **Alerts:** Discord webhooks.
- **Cost discipline:** free tiers everywhere, optimize-once-at-ingest (images, computed aggregates) rather than per-request work, dedupe before store. No per-request paid API multipliers.

---

## 10. Non-Negotiables

1. Completeness over polish — missing a real Houston tournament is the worst failure.
2. Under-the-radar scraping posture (§6.1) — the supply line depends on it.
3. All DUPR access through the single metered client (§6.2).
4. Snapshot rating/results history append-only, starting immediately.
5. "Over cap," never "sandbagger," in anything public.
6. Free listings stay free; no registration-fee cut.
7. Consent floor on social content: aggregates yes, shaming individuals no.
8. `.env*` never committed (only `.env.example`). `infra.yaml` updated with any infra change.
9. Keep monthly infra cost near zero until revenue.

---

## 11. Fixed vs. Flexible

**Fixed (the spec):** the mission and moat thesis (§1), revenue ladder (§2), product surfaces existing in some form (§4), data concepts (§5), pipeline rules (§6), intelligence substance (§7), design direction (§8), non-negotiables (§10).

**Flexible (reimagine as you see fit):** monorepo layout; schema normalization and naming; job orchestration (Actions vs. queues vs. crons); page composition, navigation, and IA; how field intel is visualized; the badge taxonomy; admin UX; component library internals; any feature's specific interaction design; adding delight/gamification anywhere it serves the "fun, not dry" mandate. If you see a structurally better way to deliver a surface in §4, take it — the job-to-be-done is the contract, not the current page.

**Known roadmap ideas to weigh (optional, not required for one-shot):** past-tournament archive pages, winnings tracking, bracket visualization (interactive tree with player path tracing), multi-city expansion, PickleRadar Wrapped, CourtReserve as a source, watchlists/alerts for premium.
