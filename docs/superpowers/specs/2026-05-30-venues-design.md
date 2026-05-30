# Venues — Design Spec

> v1 = **Foundation + Venue Pages/SEO**. Photos, follow/alerts, recurring-series detection, and venue-level field-intel aggregation are **v2** (schema designed to make them cheap to add, but not built here).

## Goal

Turn `location` — today a set of messy, duplicated free-text columns on `tournaments` (`location_name`, `location_address`, `latitude`, `longitude`, populated raw from the PickleballBrackets scraper at `packages/scrapers/src/sources/pickleballbrackets.ts:521-524`) — into a deduped, first-class `venues` entity that tournaments link to via FK. Then ship one server-rendered, indexable page per venue at `/[city]/venues/[slug]` ("[Venue] Pickleball Tournaments") to capture long-tail SEO and give each venue a durable canonical URL.

Canonical venue identity is a **Google Place ID**, resolved **once at scrape time** (never per page-view). Identical physical locations that arrive under slightly different names/coords collapse to one venue row.

## Scope

### In scope (v1)
1. **`venues` table** (migration **024**) keyed by `place_id UNIQUE` with a non-null deterministic fallback key for un-resolvable locations.
2. **`tournaments.venue_id`** FK (nullable; backfilled, then populated at ingest).
3. **Scraper wiring**: at ingest, resolve each scraped location to a venue and link the tournament (`packages/scrapers/src/utils/upsert.ts`).
4. **Cost-guarded resolution**: cheap DB precheck (existing venue within ~75 m with a similar name) → reuse without a Places call; only call Google Places `searchText` for genuinely-new locations. Fallback creates a venue with `place_id = NULL` keyed on normalized-name + rounded-coords so nothing is dropped.
5. **One-time backfill** of existing tournaments → venues (resumable, rate-limited).
6. **Venue page** `/[city]/venues/[slug]`: header, map pin, cadence summary, upcoming + past tournament lists, SEO metadata + canonical + OpenGraph, JSON-LD (`SportsActivityLocation` + nested `Event` list), `generateStaticParams`, sitemap entries.
7. **Linking**: venue names on tournament cards (`tournament-card.tsx`) and the tournament detail page (`[city]/tournaments/[id]/page.tsx`) link to the venue page.

### Out of scope (v2 — design for, do not build)
- Venue **photos** (Places Photo API) — column `photo_url TEXT NULL` reserved.
- Venue **website** enrichment beyond what the scraper already has — column `website TEXT NULL` reserved.
- Venue **follow / alerts** (subscribe to a venue).
- **Recurring-series detection** ("this venue runs a tournament every 2nd Saturday").
- Venue-level **field-intelligence aggregation** (avg field strength across a venue's history).
- Places **ratings / hours / price level** — fetchable later via the stored `place_id` with zero re-resolution.
- Multi-city venue routing beyond `getNearestCity` (only Houston exists today; `apps/web/src/lib/cities.ts:11`).

## Data model

Latest existing migration is `023_player_claims.sql`, so this is migration **024**. The DB already has `cube` + `earthdistance` extensions and `ll_to_earth` GiST indexing (`supabase/migrations/001_initial_schema.sql:7-8,120-122`); we reuse them.

`supabase/migrations/024_venues.sql`:

```sql
-- =============================================================================
-- venues: deduped, first-class location entity. Canonical key = Google place_id.
-- =============================================================================

CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Canonical Google Places identity. NULL when Places could not resolve the
  -- location; in that case dedup_key carries a deterministic fallback identity.
  place_id TEXT UNIQUE,

  -- Deterministic dedup key, ALWAYS set. For place_id-resolved venues it is
  -- "place:<place_id>"; for fallbacks it is "loc:<normalized-name>:<lat5>:<lng5>"
  -- (coords rounded to 5 decimals ≈ 1.1m). Guarantees idempotent upserts.
  dedup_key TEXT NOT NULL UNIQUE,

  name TEXT NOT NULL,                 -- canonical display name (Places displayName, else cleaned scraped name)
  slug TEXT NOT NULL UNIQUE,          -- URL slug, e.g. "memorial-park-pickleball"
  formatted_address TEXT,             -- Places formattedAddress, else scraped address
  latitude DECIMAL(10, 7),           -- canonical coords (Places location, else scraped)
  longitude DECIMAL(10, 7),

  city_slug TEXT,                    -- nearest PickleRadar city (cities.ts getNearestCity), for routing

  -- v2 reservations (nullable, never written in v1)
  photo_url TEXT,                    -- Places Photo (v2)
  website TEXT,                      -- venue website (v2)

  source TEXT NOT NULL DEFAULT 'places',  -- 'places' | 'fallback'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geo precheck index (matches the tournaments pattern in 001).
CREATE INDEX idx_venues_geo ON venues USING gist (
  ll_to_earth(latitude, longitude)
);
CREATE INDEX idx_venues_city ON venues(city_slug);
CREATE INDEX idx_venues_slug ON venues(slug);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
-- Public read (same posture as tournaments_select in 001); writes are service-role only.
CREATE POLICY "venues_select" ON venues FOR SELECT USING (true);

CREATE TRIGGER venues_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();   -- function defined in 001

-- =============================================================================
-- tournaments.venue_id FK (nullable; backfilled then populated at ingest)
-- =============================================================================

ALTER TABLE tournaments
  ADD COLUMN venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

CREATE INDEX idx_tournaments_venue ON tournaments(venue_id);

-- =============================================================================
-- find_nearby_venue RPC: cheap geo+name precheck before any Places call.
-- Mirrors find_nearby_tournament (002_dedup_schema.sql:36-61) but for venues,
-- with no date constraint and a name-similarity gate applied in app code.
-- Returns the single closest venue within p_max_distance_meters.
-- =============================================================================

CREATE OR REPLACE FUNCTION find_nearby_venue(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_max_distance_meters DOUBLE PRECISION
)
RETURNS TABLE(id UUID, name TEXT, slug TEXT, distance_meters DOUBLE PRECISION) AS $$
BEGIN
  RETURN QUERY
    SELECT v.id, v.name, v.slug,
           earth_distance(ll_to_earth(v.latitude, v.longitude),
                          ll_to_earth(p_lat, p_lng)) AS distance_meters
    FROM venues v
    WHERE v.latitude IS NOT NULL AND v.longitude IS NOT NULL
      AND earth_distance(ll_to_earth(v.latitude, v.longitude),
                         ll_to_earth(p_lat, p_lng)) < p_max_distance_meters
    ORDER BY earth_distance(ll_to_earth(v.latitude, v.longitude),
                            ll_to_earth(p_lat, p_lng))
    LIMIT 5;
END;
$$ LANGUAGE plpgsql STABLE;
```

Notes:
- `place_id UNIQUE` is the canonical dedup key. `dedup_key NOT NULL UNIQUE` is the *operational* idempotency key — it is set for **every** venue (place-backed or fallback), so `ON CONFLICT (dedup_key) DO UPDATE` is always safe. We keep both because `place_id` can legitimately be NULL.
- We return the top 5 nearby candidates (not 1) so the app-side name-similarity gate can pick the best *named* match, not merely the geographically closest.
- No new extension is needed; `cube`/`earthdistance` already enabled.

## Identity & dedup algorithm

The web app's existing Places usage (`apps/web/src/app/api/places/autocomplete/route.ts`, `.../details/route.ts`) uses Places **v1** with `X-Goog-Api-Key` + `X-Goog-FieldMask` and the env var **`GOOGLE_PLACES_API_KEY`**. The scraper runs in Node (`packages/scrapers`) and auto-loads `.env`/`.env.local` via `loadLocalEnv()` (`packages/scrapers/src/utils/supabase.ts:22-53`), so it can read the same `GOOGLE_PLACES_API_KEY`. The scraper needs its *own* Places call because it does not run in the web app; the right primitive for "name + coords → place_id" is **Text Search** (`places:searchText`) with a `locationBias` circle around the scraped lat/lng.

### Resolution flow (per scraped location)

Input: `{ name, address, latitude, longitude }` from the scraped tournament.

1. **Normalize** the scraped name (`normalizeVenueName`): lowercase, strip punctuation, collapse whitespace, drop common noise tokens (`the`, `pickleball`, `courts`, `club`, `center`, `complex`, `&`). Used only for comparison, never for display.
2. **GPS precheck (free).** If we have coords, call `find_nearby_venue(lat, lng, 75)`. For each candidate, compute a name-similarity score (token-set Jaccard on normalized names). If any candidate is within 75 m **and** similarity ≥ 0.5 (or one normalized name is a subset of the other), **reuse that venue** — return its `id`. No Places call.
3. **Places resolve (1 call, new venues only).** Otherwise call `places:searchText`:
   ```
   POST https://places.googleapis.com/v1/places:searchText
   Headers:
     Content-Type: application/json
     X-Goog-Api-Key: <GOOGLE_PLACES_API_KEY>
     X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location
   Body:
   {
     "textQuery": "<scraped name> <scraped address-or-city>",
     "locationBias": {
       "circle": {
         "center": { "latitude": <lat>, "longitude": <lng> },
         "radius": 500.0
       }
     },
     "maxResultCount": 1
   }
   ```
   - On a hit, take `places[0]`: `place_id = places[0].id`, `name = places[0].displayName.text`, `formatted_address = places[0].formattedAddress`, canonical `lat/lng = places[0].location`. `dedup_key = "place:" + place_id`, `source = "places"`.
   - **Re-check by place_id before insert**: `SELECT id FROM venues WHERE place_id = ?`. If found (another scraped name resolved to the same place), reuse it — this is the cross-name-drift collapse the design promises.
4. **Fallback (Places miss or missing coords).** If `searchText` returns no result, or we never had coords, build a deterministic venue: `dedup_key = "loc:" + normalizeVenueName(name) + ":" + lat5 + ":" + lng5` (coords rounded to 5 decimals; `lat5/lng5 = "na"` when coords absent). `place_id = NULL`, `name = cleaned scraped name`, coords/address = scraped values, `source = "fallback"`. Nothing is ever dropped.
5. **Upsert + return id.** `INSERT ... ON CONFLICT (dedup_key) DO UPDATE SET name = EXCLUDED.name, formatted_address = COALESCE(EXCLUDED.formatted_address, venues.formatted_address), updated_at = NOW() RETURNING id`. Set `city_slug = getNearestCity(lat, lng).slug` at creation.

Net cost: **~1 Places `searchText` call per genuinely-new physical venue, ever.** Re-scrapes and same-venue tournaments hit step 2 and cost zero Places calls.

### Slug generation & collisions
- `venueSlug(name)`: lowercase, replace non-alphanumeric runs with `-`, trim leading/trailing `-`, truncate to ~60 chars. Example: `"Memorial Park Pickleball Courts"` → `memorial-park-pickleball-courts`.
- Collisions: slug is `UNIQUE`. On insert, if a slug collides with an existing venue that is **not** the same `dedup_key`, append a short disambiguator derived from the dedup key (e.g. `-<first 4 chars of a stable hash of dedup_key>`). The resolver retries the insert with the suffixed slug. Because slug is only needed for the URL (lookups happen by `dedup_key`/`place_id`), suffixing is safe and stable across re-scrapes.

## Ingest wiring

Hook point: `packages/scrapers/src/utils/upsert.ts`, inside `upsertTournaments()`, in the `row` object construction (currently `upsert.ts:77-97`). Before building `row`, call the new resolver:

```ts
const venueId = await resolveVenue({
  name: t.locationName,
  address: t.locationAddress ?? null,
  latitude: t.latitude ?? null,
  longitude: t.longitude ?? null,
});
// ...
const row = { /* ...existing fields... */, venue_id: venueId };
```

- Applies to all three write paths already in `upsertTournaments` (new canonical insert, dedup-duplicate insert, and the update path) — the resolver is called once per tournament and the resulting `venue_id` is included in `row`, so updates re-affirm the link.
- **Idempotency**: `resolveVenue` is pure-ish w.r.t. the DB — repeated calls for the same location return the same `venue_id` (step 2 precheck, then `ON CONFLICT (dedup_key)`), so re-scrapes never create duplicate venues and never spend Places calls.
- The existing tournament dedup (`findCanonicalMatch`, `upsert.ts:124-162`) is unchanged and independent — venue linking is orthogonal to cross-platform tournament dedup. A "duplicate" tournament still gets its `venue_id` set (harmless; the canonical one is what pages render).
- Resolver failures (Places error, RPC error) degrade gracefully: log and return `null` so the tournament still ingests with `venue_id = NULL`. A later backfill/re-scrape can fill it in.

## Backfill (one-time script)

`packages/scrapers/src/backfill-venues.ts`, run via `tsx`:

1. Query distinct existing locations: `SELECT DISTINCT location_name, location_address, latitude, longitude FROM tournaments WHERE venue_id IS NULL`.
2. For each distinct location, call the **same** `resolveVenue` used at ingest (single source of truth — guarantees backfill and live scraping dedup identically).
3. After resolving, link tournaments: `UPDATE tournaments SET venue_id = $1 WHERE location_name = $2 AND venue_id IS NULL AND <coords match within rounding>`. Match on the same tuple used to resolve so each distinct location's tournaments all point at the resolved venue.
4. **Resumable**: because `venue_id IS NULL` is the work filter and `resolveVenue` is idempotent, re-running the script only processes still-unlinked tournaments. Safe to Ctrl-C and restart.
5. **Rate-limited**: `await sleep(120ms)` between Places calls (≈8 req/s, well under Places quotas) and process distinct locations sequentially. Log progress every N locations.
6. **Estimated Places calls** = number of *genuinely distinct physical venues* among existing tournaments, **not** the number of tournaments. Houston-only, current data: distinct `location_name` count is the upper bound; with the 75 m+name precheck collapsing spelling/coord drift, expect on the order of **a few dozen to ~150** `searchText` calls total (see "estimated total" in the final report). Each subsequent re-scrape adds ~1 call only when a brand-new venue appears.

## Venue page

Route: `apps/web/src/app/[city]/venues/[slug]/page.tsx`. Mirrors the tournament detail page conventions (`[city]/tournaments/[id]/page.tsx`).

### Rendering
- **Header**: venue name (h1), formatted address, nearest-city breadcrumb (`← Back to {City}`), upcoming-count.
- **Map pin**: reuse `apps/web/src/components/mini-map.tsx` (MapLibre + OpenFreeMap tiles) centered on `venues.latitude/longitude` when present.
- **Cadence summary**: a short human line computed from this venue's tournament history — e.g. "Hosted N tournaments since {first date}; next on {date}." (Pure function over the venue's tournament list; no recurring-series ML — that's v2.)
- **Upcoming list**: tournaments at this venue with `date_end >= today`, ascending, rendered with the existing `TournamentCard`.
- **Past list**: tournaments with `date_end < today`, descending (capped, e.g. 20).

### SEO
- `title`: `"{Venue} Pickleball Tournaments — PickleRadar"`.
- `description`: `"Every pickleball tournament at {Venue} in {City}. Upcoming events, past results, and registration links."`.
- `alternates.canonical`: `https://pickleradar.app/{city}/venues/{slug}`.
- `openGraph` + `twitter`: same shape as the tournament page (`tournaments/[id]/page.tsx:37-50`); use the site default OG (no per-venue `/api/og` image in v1).
- `revalidate = 600` (matches tournament detail).
- **JSON-LD**: a `SportsActivityLocation` (subtype of `Place`) for the venue (name, address, geo) with an `event` array of nested `SportsEvent` items for upcoming tournaments — mirrors the `Place` + `SportsEvent` shapes already used at `[city]/page.tsx:84-98` and `tournaments/[id]/page.tsx:89-123`.
- **`generateStaticParams`**: enumerate venues that have at least one active tournament, returning `{ city: city_slug, slug }`.
- **Sitemap**: extend `apps/web/src/app/sitemap.ts` to add one entry per venue (`/{city_slug}/venues/{slug}`, `changeFrequency: "weekly"`, `priority: 0.6`).

### Data layer
Add to `apps/web/src/lib/queries.ts`:
- `getVenueBySlug(slug)` → `Venue | null`.
- `getVenueTournaments(venueId)` → `{ upcoming: Tournament[]; past: Tournament[] }` (single query split by date in app code; reuses `attachIntelligenceAggregates`).
- `getVenuesForSitemap()` → `{ slug, city_slug, updated_at }[]` for venues with ≥1 active tournament.
Add `Venue` interface to `apps/web/src/lib/types.ts`.

### Linking
- `tournament-card.tsx:53` venue line (`{t.location_name}`) becomes a link to the venue page when `t.venue_id` and a resolvable slug are available (card must receive venue slug; simplest is to include `venue_slug` on the `Tournament` type via the query join, falling back to plain text when null).
- `tournament-detail.tsx` venue name links to the venue page similarly.

## Non-functional

### Under-the-radar vs PickleballBrackets
- **The scraper is the only thing that touches PBB.** Venue resolution uses **Google Places** (a sanctioned API) — zero PBB footprint. We never hotlink or proxy PBB assets; venue photos (v2) will come from Places, not PBB.
- Venue pages render only PickleRadar-owned data (our `venues` rows + our `tournaments` rows). No new PBB requests are introduced per page-view.

### Cost-conscious
- **Optimize once at ingest**: Places `searchText` is called at scrape time only, never per page-view. Stored `place_id`/coords/address are reused forever.
- **Aggressive dedup**: the 75 m + name-similarity precheck (`find_nearby_venue`) means re-scrapes and additional tournaments at known venues cost **zero** Places calls. Steady-state ≈ 1 call per brand-new venue.
- **Free tiers / no per-request multipliers**: map tiles are OpenFreeMap (already in use, free); no `/api/og` render per venue in v1; venue pages are `revalidate`-cached (600 s) and statically paramed, so DB reads are bounded.
- Backfill is one-time and rate-limited; its call count equals distinct venues, not tournaments.

## Edge cases

- **Missing coords** (`latitude`/`longitude` null): skip the GPS precheck and `locationBias`; still attempt `searchText` with `textQuery = name + address`. If that misses too, fallback `dedup_key = "loc:<normname>:na:na"`. Page still renders without a map pin.
- **Online / TBD / "Unknown" venues**: the scraper already emits `locationName = "Unknown"` when nothing parses (`pickleballbrackets.ts:521`). Treat name `"Unknown"`/`"Online"`/`"TBD"` (case-insensitive) as **non-geographic**: skip Places entirely, create a single shared fallback venue per such label (`dedup_key = "loc:unknown:na:na"`), and **exclude these from `generateStaticParams`/sitemap** (no SEO value, no map). Tournaments still link so they're not orphaned.
- **Two distinct venues at one address/coords** (e.g. two clubs sharing a complex): disambiguated by `place_id` — Places returns different IDs, so they become two venue rows even though coords are close. The 75 m precheck's name-similarity gate prevents wrongly merging them (different names → no reuse → separate Places resolve → distinct `place_id`).
- **Venue name changes over time** (PBB renames a venue): `place_id` is stable, so re-scrapes resolve to the **same** venue row; we refresh `name` on conflict. Slug stays put (lookups are by id/place_id), preserving the indexed URL.
- **City assignment**: `city_slug = getNearestCity(lat, lng).slug` at venue creation (`cities.ts:31`). With only Houston configured, all geo'd venues route under `/houston/venues/...`. If coords are missing, default to `getDefaultCity().slug` (`houston`). Adding cities later is config-only.
- **Slug collision across distinct venues**: handled by the dedup-key-hash suffix (see "Slug generation & collisions").
- **Places returns a wildly wrong match** (locationBias too loose): mitigated by the 500 m bias radius + name in `textQuery` + `maxResultCount: 1`; a wrong match still produces a stable venue and is correctable later by clearing `venue_id`/`place_id` (out of scope to auto-detect).

## Testing strategy

Pure, unit-testable helpers (mirroring `packages/scrapers/test/` conventions — vitest, `npm run test` in the scrapers workspace, tests import `../src/...js`):
- **`venueSlug`**: name → slug, including punctuation, casing, truncation, and the collision-suffix path.
- **`normalizeVenueName`** + **`nameSimilarity`**: noise-token stripping; Jaccard thresholds; subset matches; that "Memorial Park Pickleball" and "Memorial Park PB Courts" score ≥ 0.5.
- **`venueDedupKey`**: `place:<id>` vs `loc:<normname>:<lat5>:<lng5>` vs `loc:...:na:na` (missing coords); rounding to 5 decimals.
- **`mapSearchTextResponse`**: a sample Places `searchText` JSON → `{ place_id, name, formatted_address, latitude, longitude }`; and the empty-`places` (miss) case → `null`.
- **`resolveVenue`** integration: tested with a **mocked Places client** (inject a `fetch`-like dependency) and a **mocked Supabase** (the project already mocks Supabase-shaped objects in tests). Cases: precheck-hit returns existing id with **no** Places call; precheck-miss triggers exactly **one** Places call then upserts; Places-miss path produces a fallback venue; place_id re-check collapses two different names to one venue.

Mockable: the Places HTTP call (inject the client) and the Supabase client. Not unit-tested (covered by manual/staging run): the actual SQL migration and the Next.js page render — verified by `npm run build:web` and a staging page hit.

---

## Self-review

- **Placeholder scan**: no `TODO`/`TBD`/`FIXME`/`???` left in the design. The only literal "TBD"/"Unknown"/"Online" strings are intentional venue-label handling in Edge Cases.
- **Internal consistency**:
  - Migration number **024** is consistent everywhere (latest existing = `023_player_claims.sql`). ✓
  - Env var **`GOOGLE_PLACES_API_KEY`** matches the existing Places routes. ✓
  - `dedup_key` is `NOT NULL UNIQUE` and used for every `ON CONFLICT`; `place_id` is `UNIQUE` but nullable — both stated consistently in Data model, Identity flow, and Backfill. ✓
  - `find_nearby_venue` returns top-5 and the app applies the name gate — consistent between Data model and Identity flow. ✓
  - `resolveVenue` is the single resolver used by both ingest and backfill — stated in both sections. ✓
- **Scope check**: every v1 item from the locked decisions appears (table, scraper wiring, backfill, dedup, venue page w/ SEO + JSON-LD). Photos/follow/recurring/field-intel are explicitly out and only reserved as nullable columns (`photo_url`, `website`). ✓
- **Constraints**: under-the-radar (Places-only, no PBB footprint per view) and cost-conscious (1 call/new venue, cached pages, free tiles) are each addressed in Non-functional with the exact mechanism. ✓
