# Share Loop — Make Shares Land

**Date:** 2026-08-10
**Status:** Approved (Ben, 2026-08-10)
**Goal:** Reach. Amplify the one acquisition channel that demonstrably works (links pasted into group chats) and make every share carry bracket-level intel.

## Evidence driving this

- Vercel (30d): ~308 pageviews, 83% direct/no-referrer, 52% mobile → traffic arrives via shared links, not feeds or search.
- PostHog (30d, test accounts filtered): 35 visitors, avg session 7m20s, ~27% of `tournament_viewed` lead to `register_button_clicked` — the product converts when reached.
- Weekly retention ≈ 0 → every week's traffic must be re-acquired; the share loop is the re-acquisition machine.
- `share_clicked` has never fired despite ShareButtons existing on tournament pages.
- Current OG card (`/api/og`) is a 776KB PNG. WhatsApp drops link-preview images above roughly 300–600KB, so shares into the most common chat apps may show a bare URL.
- Stale `src/app/[city]/tournaments/[id]/opengraph-image.tsx` (old green-gradient design) still exists; Next file-convention metadata can override the good `/api/og` card. Regression trap.

## The experience

A player on their phone, viewing their bracket's field intel, taps **Share** → their group chat receives a rich card showing *their bracket's* field strip and avg rating. Recipients tap through and land with that bracket pre-selected. FB posts (ops, not in this spec) use the same card images, so injected and organic traffic look identical and both carry UTMs.

## Design

### 1. Preview weight — `/api/og` PNG → JPEG on Node runtime

- Change `src/app/api/og/route.tsx` from `runtime = "edge"` to Node (Vercel's current guidance prefers Node/Fluid over edge).
- Render with `ImageResponse` exactly as today, then transcode the PNG buffer to JPEG (~quality 80) with `sharp` before responding. Target: photographic 1200×630 at ~100–150KB, always < 300KB.
- Response headers: `Content-Type: image/jpeg`, `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` so chat-app scrapers hit the CDN, not Supabase.

### 2. Bracket-level shares

- Tournament page accepts `?bracket=<key>`.
- `generateMetadata` reads `searchParams.bracket` and, when present, points `og:image` at `/api/og?id=<id>&bracket=<key>`; `/api/og` renders the existing field-strip card style for that bracket (falls back to the tournament card when the bracket key is unknown).
- On load, `?bracket` seeds `SelectedBracketProvider` so the recipient lands on the shared bracket.
- `ShareButtons`: when a bracket is selected, share the bracket URL and bracket-specific text (e.g. "4.0 Mixed: 12 teams, avg DUPR 3.87, 2 over cap").

### 3. Contextual share CTA

- Share affordance inside the field-intel section: "Send to your group chat".
- Mobile: native share sheet (`navigator.share`); desktop: copy-text fallback.
- Reuse existing UTM plumbing (`lib/share-url.ts`): `utm_medium=native_share|copy_text`, `utm_campaign=tournament`, `utm_content=<tournamentId>:<bracketKey>`.
- Existing header/footer ShareButtons stay.

### 4. Cleanup

- Delete `src/app/[city]/tournaments/[id]/opengraph-image.tsx` (and its now-unused imports/assets if any).

## Verification (definition of done)

1. Render cards for 3 real tournaments (tournament-level and bracket-level) and show them to Ben.
2. Each rendered card < 300KB, `image/jpeg`.
3. Tournament URL passes Facebook Sharing Debugger with the intel card as preview.
4. A real click on the new CTA produces a `share_clicked` event visible in PostHog (with bracket property).
5. Opening a `?bracket=` URL lands with that bracket selected in both Field Intelligence and Bracket & Results.

## Out of scope

- Profile gate rework (20 gate views → 1 signup click; revisit separately).
- Actually posting to FB groups (ops, this week, using these cards).
- Venues / programmatic SEO — separate workstream; see `2026-05-30-venues-design.md` as the starting point for its refreshed spec.
