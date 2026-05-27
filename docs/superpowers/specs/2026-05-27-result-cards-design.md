# Result Cards — Design Spec

## Goal
Auto-generate shareable tournament result cards so players can post their placement on IG stories, iMessage, and Facebook groups. Each share links back to PickleRadar. Target: ship before Casa Pickle ends (May 31).

## Data Layer

### Schema change
Add to `event_players`:
```sql
alter table event_players add column placement smallint; -- 1=gold, 2=silver, 3=bronze, null=unplaced
```

### Placement scraping
After a tournament completes, the PBB `tourneyEvents` API returns:
- `goldMedalTeam`: HTML string (e.g., "Janet Kwon<br>Blanca Tejada")
- `silverMedalTeam`, `bronzeMedalTeam`: same format
- `status.id: 3` = completed

The live-matches scraper already polls `tourneyEvents`. Extend it to:
1. Check for events with `status.id === 3` (completed)
2. Parse medal team names from the HTML strings (split on `<br>`)
3. Match names to `event_players` rows for that event
4. Write `placement` = 1/2/3

Name matching: case-insensitive trim comparison against `player_name`. If a medal name doesn't match any event_player, log a warning and skip.

### Pick tracking
```sql
create table result_card_picks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references tournament_events(id),
  player_id uuid references players(id),
  style text not null, -- 'dark', 'editorial', 'podium'
  created_at timestamptz default now()
);
```
Insert on download/share click. No RLS needed (server action).

## Image Generation

### Route: `app/api/result-card/route.tsx`
- Edge runtime, `next/og` ImageResponse
- Query params: `eventId`, `playerId`, `style` (dark | editorial | podium)
- Output: 1080x1350px PNG (IG story ratio)
- Cached by URL params (Vercel edge cache)

### Data fetched per request
- `event_players` row (player_name, partner_name, placement, enriched_dupr, partner_enriched_dupr)
- `tournament_events` row (name)
- `tournaments` row (name, date_start, date_end, location_name)
- Player's W-L record for that event (count wins/losses from `tournament_matches`)

### Three styles

**Dark & Bold** (`style=dark`)
- Dark green gradient background (#065f46 → #064e3b → #1a1a1a)
- Large emoji medal (🥇/🥈/🥉)
- Gold text for placement label
- Player names large and centered
- Event + tournament info in frosted card at bottom
- DUPR ratings inline

**Clean Editorial** (`style=editorial`)
- Cream background (#FFFDF7) matching site brand
- "1ST PLACE" pill in dark green
- Large bold player names, left-aligned
- Tournament info below a thick border rule
- DUPR + Record in green stat boxes

**Podium** (`style=podium`)
- Cream-to-green gradient background
- Mini podium visualization: 1st (tall, green), 2nd (medium, gray), 3rd (short, amber)
- All three medal teams shown on podium
- "Your Result" highlighted card below with placement, DUPR, record

## Result Page

### Route: `app/results/[eventId]/[playerId]/page.tsx`
- Server component, `revalidate = 3600`
- Fetches player placement data, event, tournament
- If no placement found, 404

### Layout
1. Tournament name + event name header
2. Placement badge (🥇 1st Place / 🥈 2nd Place / 🥉 3rd Place)
3. Player name(s) + DUPR + record
4. **Style picker**: three thumbnail cards, click to select (client component)
5. Selected card shown large
6. Action buttons: "Download Image" (fetches /api/result-card as blob, triggers download), "Share" (navigator.share with URL + text, fallback to copy)
7. Track style pick on download/share click

### OG metadata
The page's OG image uses the `editorial` style card by default, so link previews look good even before the user picks a style.

## Entry Points (ship for Casa Pickle)

### Tournament page — podium section
After events have placements, show a "Results" section:
- Mini podium per event with Gold/Silver/Bronze names
- "Share your result →" link per medalist → `/results/[eventId]/[playerId]`
- Appears below the Bracket & Results section

## Entry Points (follow later)

### Player page banner
When a player has a recent placement (< 30 days), show banner at top of their player page.

### Email notification
Requires player-to-user linking. Post-tournament email to placed players with link to their result page.

## Out of scope
- Animated virtual podium (roadmap item)
- Custom text/captions on cards
- Video generation
- Non-medalist result cards (participation cards could come later)
