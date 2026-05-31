# Flyer → Listing: design spec

**Status:** approved design, ready for implementation plan.
**Date:** 2026-05-30

## Goal

Turn a Facebook-only tournament flyer (image + post text) into a **private draft
tournament page** that we send to the organizer, who confirms it for publishing.
Captures grassroots tournaments that never appear on PickleballBrackets, and
recruits tournament directors (TDs) as first-party contributors.

## Why

- **Unique inventory.** These tournaments aren't on PBB — they're top-of-funnel
  supply nobody else lists.
- **First-party data + relationship.** A TD-confirmed listing is data PBB can't
  cut off, and starts the "flip the relationship / legitimacy" path in the data
  resilience plan.
- **Complements, doesn't duplicate.** The flyer gives the early announcement; if
  PBB lists the same event later, the existing dedup merges them and the scrape
  enriches the organizer's record with the player roster.

## Scope

### v1 (this spec) — admin-seeded, concierge publish, LLM-assisted
- Admin pastes the FB post text + uploads the flyer image.
- An LLM (Claude, vision) extracts structured fields into an **editable** draft form.
- Saving creates a `tournaments` row with `status='draft'` (private/unlisted).
- The draft renders at the normal tournament URL with a "DRAFT" banner + `noindex`,
  excluded from every public surface.
- Admin sends the private link to the TD (manual outreach, contact usually on the
  flyer). System provides the shareable link + a copy-paste outreach template.
- TD replies "yes" → admin clicks **Publish** → `status='active'` (live, indexed,
  listed).

### Explicitly out of v1 (future phases — design must not preclude)
- **Crowdsourced** intake (public "paste a flyer" + moderation queue).
- **TD self-serve** (TD pastes their own flyer).
- **Publish mechanic upgrades:** concierge → magic-link one-click → verify-OTP.
- Automated outreach / messaging.
- Storing/serving the flyer image as listing artwork (kept only for extraction in v1).

## Architecture

```
Admin (/admin/flyer-import)
  │  paste post text + upload flyer image
  ▼
LLM extract (server action / route)  ──►  Claude vision → structured JSON
  │  pre-fill editable draft form (admin reviews/edits)
  │  venue confirmed via existing Places-backed VenueSearch → venue row
  ▼
Create tournaments row  status='draft'  (+ tournament_sources: flyer)
  │
  ├─ private preview  /[city]/tournaments/[id]  (DRAFT banner, noindex, unlisted)
  │     admin copies link + outreach template → sends to TD (manual)
  ▼
Admin clicks Publish  ──►  status='active'  (public, indexed, listed)
  │
  └─ later: PBB scrape at same venue+date → existing canonical dedup merges;
            flyer/organizer row stays canonical, scrape enriches (roster).
```

### Components

1. **Admin flyer-import page** — `apps/web/src/app/admin/(dashboard)/flyer-import/`
   - Textarea for the FB post; file input for the flyer image.
   - "Extract" button → calls the extraction endpoint → pre-fills the form.
   - Editable draft form (all extracted fields), venue via `VenueSearch`.
   - "Save draft" → creates the draft tournament; shows the private link + outreach
     template + a "Publish" button.
   - Lives behind existing admin auth (`user_roles`, the `(dashboard)` layout is
     already `force-dynamic` + role-gated).

2. **Extraction endpoint** — `apps/web/src/app/api/flyer-extract/route.ts`
   - Input: `{ text: string, imageBase64?: string }`.
   - Calls Claude (vision) with a strict JSON schema; returns the structured draft
     fields + a per-field `confidence` hint where useful.
   - Server-only; admin-gated.

3. **Draft tournament** — a `tournaments` row, `status='draft'`, provenance recorded
   via a `tournament_sources` row with `source_platform='flyer'`.

4. **Private preview** — the existing tournament detail page, extended to render a
   DRAFT banner + `noindex` and to be reachable by direct URL only.

5. **Publish action** — admin-only server action flipping `status` to `active`
   (with `revalidatePath` for the city + venue pages).

## Data model

No new tables. Reuse `tournaments` + `tournament_sources`.

- `tournaments.status` — add the value `'draft'` (column already exists; today's
  public rows are `'active'`). Drafts are private.
- Provenance — insert a `tournament_sources` row: `source_platform='flyer'`,
  `source_url` = the FB post URL (if known), no registration scrape.
- All location/venue fields populate exactly as scraped tournaments do, and the
  draft is linked to a `venue`. **Venue linking on the web side** (the admin
  confirms a place via the existing Places-backed `VenueSearch`, giving
  placeId/name/address/coords) needs a venue upsert the web app can call. The
  scraper's `resolveVenue` lives in `packages/scrapers`; the plan should either
  factor the shared venue-identity + upsert logic into an importable module or
  add a small web-side equivalent keyed on `place_id`. **Decision for the plan.**

**Public-surface exclusion (the critical invariant): every public read must filter
`status='active'`.** Audit and confirm each of these already does (most do today):
- `getTournamentsByCity` (city listings)
- venue queries (`getVenueTournaments`, `getVenuesForSitemap`)
- the tournament map
- `getRelatedTournaments` / "More at [venue]" (filter the source lists)
- sitemap + `generateStaticParams` for tournament + venue routes
- search/RPC (`tournaments_near`)

The tournament **detail** query (`getTournament`) intentionally does NOT filter
status — that's what makes the draft viewable by direct link. The detail page
renders the DRAFT banner + `noindex` when `status !== 'active'`.

## LLM extraction

- **Model:** Claude (vision-capable, latest). Called server-side with the image +
  text. One call per flyer, admin-triggered → low volume, cheap (honors
  cost-conscious: optimize-once, no per-pageview cost).
- **Output schema (the field set):**
  - `name` (string)
  - `dateStart`, `dateEnd` (ISO dates; single-day → equal)
  - `startTime`, `endTime` (optional, local)
  - `venueName`, `venueAddress` (strings; confirmed via VenueSearch)
  - `eventTypes` / `format` (e.g. doubles, skill brackets if present)
  - `teamSize` (e.g. 2 players/team)
  - `price`, `earlyBirdPrice`, `earlyBirdEnds` (optional)
  - `registrationUrl` or `registrationContact` (link, email, phone, or IG/FB handle)
  - `host` / `beneficiary` (org name)
  - `confidenceNotes` (free text the admin should double-check)
- **The admin always reviews and edits before saving.** The LLM pre-fills; it never
  auto-publishes. Conflicting flyer vs post values (they often disagree) are
  surfaced for the admin to pick.
- Untrusted-input note: flyer/post content is data, not instructions — the
  extraction prompt treats it as content to parse only.

## Reconciliation with later scrapes

When a published flyer tournament and a PBB-scraped tournament are the same event:
- The existing dedup (`find_nearby_tournament`: same date + ~100m) matches them.
  With venues now resolved, `venue_id` + date is an even stronger signal.
- **The flyer/organizer row is canonical**; the scraped one attaches as an
  additional `tournament_sources` entry and enriches (events/roster) without
  overwriting the organizer's name/details.
- The dedup currently runs in the scraper ingest; confirm it considers existing
  flyer-sourced rows (status active or draft) when matching. A draft that hasn't
  been published yet should still be matchable so we don't create a public
  duplicate.

## Non-functional

- **Cost-conscious:** one LLM vision call per flyer at creation; nothing per
  page-view. Reuses existing tournament/venue/OG infrastructure.
- **Under-the-radar:** N/A in a bad way — this source is *not* PBB, so it's outside
  that constraint and actively reduces single-source dependence.
- **Privacy/abuse:** drafts are unlisted-by-obscurity (unguessable UUID) +
  `noindex`; admin-only creation in v1, so no public-abuse surface yet. OTP/verify
  arrives when intake opens up.

## Edge cases

- **Flyer vs post disagree** (time, address): surface both, admin picks.
- **Vague venue** ("Missouri City"): same policy as the venue resolver — the admin
  confirms a real venue via VenueSearch, or leaves it unlinked.
- **Missing date / unparseable:** draft saves with blanks; admin fills. Never
  publish with a missing date.
- **Duplicate of an already-listed tournament:** on save, warn if a same-venue/date
  tournament already exists (reuse the dedup check) so we don't double-create.
- **TD never responds:** draft stays private indefinitely; no auto-publish in v1.
- **Image-only flyer (no post text):** extraction runs on the image alone.
- **Non-tournament image:** extraction returns low confidence / empty; admin discards.

## Testing strategy

- **Unit:** the extraction output → draft-row mapping (pure function; mock the LLM
  response). Date/price/venue normalization. The public-query `status='active'`
  filter (assert drafts excluded from each listing query).
- **Integration:** create-draft → not in city list/sitemap → reachable by direct
  URL with DRAFT banner → publish → appears in list, banner gone, indexed.
- **LLM call itself** is mocked in tests (injected client), like `places-client`.

## Open questions resolved in design

- Draft-as-tournament-row (not a separate table). ✓
- Lives in `/admin`, reuses admin auth. ✓
- Concierge publish for v1; phases to magic-link then OTP. ✓
- Organizer record canonical on later merge. ✓
