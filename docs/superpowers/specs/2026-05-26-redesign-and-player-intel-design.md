# PickleRadar Redesign + Player Intel — Design Spec

## Problem

Current pages are hard to read: too much info at once, weak visual hierarchy, and the DUPR intelligence (our differentiator) is buried. Player profiles are bare. Users can't connect their own DUPR data to get personalized tournament intel.

## Design Decisions

### Visual Language

- **"Field Intelligence" branded sections** — dark green (#065f46) header bar on any section powered by DUPR data. Consistent across all pages.
- **No sidebar on tournament detail** — everything flows vertically, full-width.
- **Stat cards** for quick-scan numbers (registered, entry fee, alerts).
- **Green intel bar on tournament list cards** — only appears when we have live DUPR data. Signals "this one has intelligence."
- **Progressive disclosure** — events start collapsed, expand to show players + distribution.

### Tournament List Cards (Homepage)

- Clean card: date + event count, name, venue, price
- Badge row: registered count, field strength (Friendly/Competitive/Stacked), sandbagger alerts
- **No avg DUPR** — meaningless across brackets with different skill ranges
- Dark green intel footer bar when live DUPR data exists: "{N} live DUPR ratings · View intel →"
- Cards without intel: clean, no bar

### Tournament Detail Page

Structure (top to bottom):
1. **Tournament name** + date/venue subtitle
2. **Stat cards row**: Entry fee, Registered count, Events count, Sandbagger alerts (if any)
3. **Register CTA** (full-width green button) + utility buttons (Map, Cal, Share)
4. **Field Intelligence section** (green branded header): contains FieldIntelSummary + all EventCards
5. **Related tournaments**

EventCards:
- All start collapsed
- Expand chevron on left, event name + field strength badge, team count + avg DUPR
- Collapsed teaser: "X live DUPR ratings · Y differ from listed → View players"
- Expanded: Rating Spread chart + Player list table

Player list table:
- Verified live ratings show strikethrough of old + green live rating + delta badge
- Only shows "Verified" treatment when `dupr_verified = true` (non-provisional, confident match)
- Partner live ratings also joined and displayed

### Player Profile Page (Deep Intel)

**Header card:**
- Name, location, gender
- Doubles + Singles ratings side by side (large text)
- Verified badge on non-provisional ratings
- "Updated from DUPR" timestamp

**Record breakdown (3 stat cards):**
- Overall W-L + win rate
- Men's/Women's Doubles W-L + win rate
- Mixed Doubles W-L + win rate
- Derived from DUPR match history API, splitting on `eventFormat`

**Frequent Partners section:**
- Top 2-3 partners by match count
- Name, match count, W-L record together
- Clickable to their profile

**Recent Matches section (green branded header):**
- W/L badge (subtle, not red/green — just bold vs muted)
- Date, format (Men's Doubles / Mixed / Singles)
- Tournament/league name
- Partner name + opponent names
- Game scores

**Upcoming Tournaments section (green branded header):**
- Tournaments they're registered for (from our scraper data)
- Listed vs actual DUPR with delta (the sandbagger signal)

### "Players You Know" Feature (Tournament Detail)

When a user has linked their DUPR account:
- Cross-reference their match history with the tournament's registered players
- Show a section above the event list: "Players You Know"
- Each row: player name, your record against them (e.g. "1W-2L"), last match date
- Shareable: "I've already lost to 3 people in this bracket" — drives word of mouth

Requires: user links their DUPR (via existing profile page flow, stores their `dupr_id`)

### DUPR ID Handling

- Store `dupr_id` internally for dedup and direct API lookups
- **Never display DUPR ID in the UI** — keep it an internal implementation detail

## Data Requirements

### New: Match History Table

```sql
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dupr_match_id BIGINT UNIQUE NOT NULL,
  event_date DATE NOT NULL,
  event_format TEXT NOT NULL,          -- 'DOUBLES', 'SINGLES', 'MIXED_DOUBLES'
  league TEXT,                          -- tournament/league name from DUPR
  venue TEXT,
  
  -- Team 1
  team1_player1_id UUID REFERENCES players(id),
  team1_player2_id UUID REFERENCES players(id),
  team1_player1_name TEXT NOT NULL,
  team1_player2_name TEXT,
  
  -- Team 2
  team2_player1_id UUID REFERENCES players(id),
  team2_player2_id UUID REFERENCES players(id),
  team2_player1_name TEXT NOT NULL,
  team2_player2_name TEXT,
  
  -- Scores (up to 5 games, -1 = not played)
  game1_team1 SMALLINT,
  game1_team2 SMALLINT,
  game2_team1 SMALLINT,
  game2_team2 SMALLINT,
  game3_team1 SMALLINT,
  game3_team2 SMALLINT,
  
  team1_won BOOLEAN NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_player ON matches (team1_player1_id);
CREATE INDEX idx_matches_player2 ON matches (team1_player2_id);
CREATE INDEX idx_matches_opponent ON matches (team2_player1_id);
CREATE INDEX idx_matches_date ON matches (event_date DESC);
```

### New: Match History Scraper

- Runs after DUPR enrichment
- For each player with a `dupr_id`, fetch match history via `POST /player/v1.0/{id}/history`
- Upsert into matches table by `dupr_match_id`
- Link player IDs where we have them (by `dupr_id` cross-reference)
- Same humanized timing as enrichment (2-5s delays, long pauses, backoff)
- Only fetch for players whose match history hasn't been checked in 7 days

### DUPR Account Rotation (Future)

- Create 3-4 additional DUPR accounts for API access
- Store credentials as `DUPR_EMAIL_1`/`DUPR_PASSWORD_1`, etc.
- Rotate which account authenticates per enrichment run
- If one gets blocked, others continue

## Pages Affected

1. `apps/web/src/components/tournament-card.tsx` — add intel footer bar
2. `apps/web/src/components/tournament-detail.tsx` — remove sidebar, add stat cards row
3. `apps/web/src/app/[city]/tournaments/[id]/page.tsx` — restructure layout
4. `apps/web/src/components/event-card.tsx` — already updated, minor tweaks
5. `apps/web/src/components/event-breakdown.tsx` — already updated, minor tweaks
6. `apps/web/src/components/player-list.tsx` — already updated
7. `apps/web/src/app/players/[id]/page.tsx` — full rebuild with deep intel
8. `apps/web/src/lib/queries.ts` — new queries for match history, partners, records
9. `packages/scrapers/src/utils/dupr-enrichment.ts` — add match history fetching
10. New migration for matches table

## Implementation Phases

**Phase 1 — Visual Redesign (no new data)**
- Tournament detail: remove sidebar, stat cards, green branded sections
- Tournament list cards: intel footer bar
- Player profile: doubles + singles display improvements

**Phase 2 — Match History Pipeline**
- Matches table migration
- Match history scraper (extends enrichment)
- Player profile: record breakdown, frequent partners, recent matches

**Phase 3 — "Players You Know" (SHELVED)**
- Requires profile claiming, which requires identity verification
- DUPR doesn't offer OAuth or expose emails, so no reliable way to verify claims
- Revisit if DUPR adds an OAuth flow or we find another verification method

**Phase 4 — Hardening**
- DUPR account rotation
- Rate limit monitoring + Discord alerts on 429s
- Match history staleness tracking
