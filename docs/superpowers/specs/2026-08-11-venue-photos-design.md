# Venue Photos — Surfacing (Hero, Index, OG)

**Date:** 2026-08-11
**Status:** Approved
**Predecessor:** `2026-05-30-venues-design.md` (venues v1), commit `1f28a6d` (photo pipeline)

## Context

The Places photo *pipeline* already shipped (2026-06-03): the scraper fetches one photo per new venue at ingest, stores it in the public `venue-photos` Supabase bucket, writes `venues.photo_url`, and denormalizes to `tournaments.venue_photo_url` (migration 026). Backfill ran — verified 2026-08-11: 31/32 venues have photos; 80 tournaments carry the denormalized URL. Photos already render on tournament cards, the tournament detail hero, and tournament OG cards.

This spec covers the three surfaces that *don't* show them yet:

1. **Venue page photo hero** — `/[city]/venues/[slug]` never renders the venue's own photo.
2. **Venues index page** — `/[city]/venues` does not exist; venue pages are only reachable via tournament detail links and the sitemap.
3. **Venue OG image** — venue pages declare `summary_large_image` with no image.

**No new Places spend, no new columns, no scraper changes.** Everything reads `venues.photo_url`.

Mockup reviewed and approved 2026-08-11 (real prod data): photo hero with overlapping header card, index photo-card grid with fallback state, OG card approach B.

## Constraints

- Zero PBB footprint: photos are Places-sourced, already mirrored in our bucket — never hotlinked from Google.
- Cost-conscious: read-only feature; OG images render on-demand behind CDN cache (same as tournament OG).
- Mobile-first (~360px), warm editorial design language v2 (card-overlaps-hero, quiet one-liners, `t-*` roles, `shadow-card`).
- Places attribution: photo surfaces carry a small "Photo · Google" credit (hero + OG; index cards exempt as thumbnails).

## 1. Venue page photo hero

`apps/web/src/app/[city]/venues/[slug]/page.tsx`

- Full-bleed photo hero at top of `<main>`: `aspect-[4/3]` mobile, wider ratio (`sm:aspect-[5/2]`, `lg:aspect-[21/9]`) on larger screens — mirror the tournament-detail hero's responsive ratios.
- Dark gradient scrim (heavier top + bottom, clear middle) for legibility of overlaid controls.
- BackLink moves onto the photo as a floating white pill (top-left). "Photo · Google" credit pill bottom-right.
- Header card overlaps the hero bottom by ~56px (negative margin): venue name (`t-h1`), address, cadence line (existing copy: "Hosted 9 tournaments since May 2026. Next on Aug 12."), FavoriteButton top-right of card. White card, `rounded-2xl`, `shadow-card`.
- **No photo:** render the existing branded `HeroFallback` (emerald + radar mark + venue name) in the hero slot — layout identical, page never looks broken.
- MiniMap demotes below the tournament grids under a small "Where it is" heading (same rounded/shadow treatment). Tournament grids unchanged.

## 2. Venues index page

`apps/web/src/app/[city]/venues/page.tsx` — new.

- **Header:** eyebrow `HOUSTON` (`t-label`, emerald), h1 "Pickleball venues" (`t-h1`), subline "N venues hosting tournaments across greater {city}."
- **Card** (link to venue page): 16:9 photo with light scrim; "Next {date}" white pill top-left (only when an upcoming tournament exists); body = name (17px/800), city short-form ("Sugar Land, TX" — parsed from `formatted_address`), cadence one-liner "N tournaments · M upcoming" with emerald status dot (gray dot, no pill, when nothing upcoming).
- **Fallback card:** photo-less venue gets the branded emerald block (radar ring + uppercase name) in the photo slot.
- **Sort:** upcoming count desc → total hosted desc → name. **Every** venue with a linked tournament appears (no photo required).
- **Grid:** 1-col mobile, `sm:grid-cols-2`, `lg:grid-cols-3`.
- **Data:** one new query `getVenuesWithStats(citySlug)` — venues joined/aggregated with tournament counts + next upcoming date. Server-side, ISR `revalidate = 600`.
- **SEO:** canonical `/{city}/venues`; title "Pickleball Venues in {city} — PickleRadar"; `ItemList` JSON-LD of venues; added to sitemap.
- **Entry points:** venue page BackLink target becomes `/{city}/venues` (label "Venues"); city page gets a "Venues" link (nav or section header, match existing city-page pattern); footer link.

## 3. Venue OG image (approach B)

Extend `apps/web/src/app/api/og/route.tsx` with a venue mode (`?venue=<slug>`):

- Photo full-bleed 1200×630 from `venues.photo_url`; bottom-weighted dark scrim.
- Content: wordmark + radar mark top-left; bottom block = eyebrow "PICKLEBALL VENUE · {CITY}" (mint), venue name (64px/800), cadence line "N tournaments hosted · Next on {date}".
- Small "Photo · Google" credit.
- **No photo:** reuse the branded (non-photo) OG style with venue name.
- Same output pipeline as tournament OG: satori → sharp → mozjpeg q80, target <300KB.
- Venue page metadata gains `openGraph.images` / `twitter.images` pointing at the route.

Rejected alternatives: (A) raw stored photo as og:image — wrong size/aspect, unbranded; (C) pre-rendered OG at ingest — no cost benefit over CDN-cached on-demand.

## Cleanup ride-alongs

- **Dedupe "Casa Pickle - Space City"** (exists twice in prod; one photo-less): repoint tournaments to the photo-bearing venue, delete the orphan, verify `find_nearby_venue`/dedup key won't recreate it.
- The 1 remaining photo-less venue: attempt a one-off photo fetch via the existing backfill script; if Places has no photo, it simply exercises the fallback paths.

## Error handling

- Broken/missing image URL: `<img>` error → CSS fallback is the emerald background already behind it (no JS error state needed; background is the branded color block).
- OG route with unknown slug → 404; with photo fetch failure → branded no-photo OG (never a 500 for a share crawler).
- Index with zero venues (future city) → header + quiet empty line "No venues on record yet." (page still renders for SEO).

## Testing

- `getVenuesWithStats`: aggregation correctness (counts, next date, sort order, venues without photos included).
- OG venue mode: renders for photo and no-photo venues; output content-type + size under 300KB for a real photo fixture.
- Page tests: venue page renders hero img when `photo_url` set, `HeroFallback` when null; index renders next-pill only with upcoming tournaments.
- Usability gate: walk hero/index/OG on 360px viewport with real data before calling it done (screenshots in PR).

## Out of scope

- Multiple photos / galleries, srcset/next-image migration (photos stay single 800px stored asset).
- Follow-a-venue alerts, recurring-series detection, venue-level field intel (separate v2 items).
- Multi-city routing changes — pages stay under `[city]` with "houston" as today's only city.
