# PickleRadar — Product & Technical Specification

## Project Overview

PickleRadar is a mobile app that aggregates all local pickleball tournaments into a single feed with push notifications, share functionality, and partner matching. The app scrapes tournament data from multiple fragmented platforms and presents it in one clean, filterable interface.

**North Star:** Houston pickleball players say "just check PickleRadar" instead of scrolling through 5 different sites and 3 Facebook groups.

**Founder context:** Ben Poon is a competitive pickleball player in Houston who plays tournaments regularly with doubles partner Hue. He experiences this pain firsthand. Houston is the #1 US city for pickleball facilities (70+ locations) with an estimated 14,000 tournament-competitive players in the metro area.

---

## Why This Exists — The Problem

Tournament discovery is completely fragmented. Players must manually check all of the following to find Houston-area tournaments:

1. **PickleballBrackets.com** — most popular in Houston, modern UI, run by Pickleball OpCo
2. **PickleballTournaments.com** — largest directory (USAPA-tied), but described as "mid-1990s look", no search function, users scroll a chronological list. Also owned by Pickleball OpCo (same parent company as PickleballBrackets)
3. **Pickleball Den** — has in-app notifications but only for tournaments run on their own platform
4. **Houston Sports & Social Club (Houston SSC)** — local leagues and tournaments
5. **Sportsmonkey** — local leagues
6. **Facebook groups** — casual events, round robins, charity tournaments, club events
7. **Individual club websites** — Chinese Community Center, various facility-run events

No platform aggregates across all of these. No platform sends push notifications when new local tournaments open. Registration windows fill fast, and late discovery = missed opportunities.

**Validated user quotes:**
- "With the explosion of pickleball it has become increasingly difficult to find ALL pickleball events in one place" (AllPickleballTournaments.com built their entire business on this pain)
- PickleballTournaments.com described as "unwieldy" with "mid-1990's look" — one user "sulked and vowed never to return"
- DUPR app called "one of the worst experiences I've ever personally used"

---

## Market Context

- 19.8M US pickleball players (2024), 45.8% YoY growth
- 8.5M regular players (8+ times/year)
- 30% YoY growth in tournament registrations globally
- Houston metro: ~140K players estimated, ~14K tournament-competitive
- Target for MVP validation: 700 active Houston users

---

## Competitor Landscape

| Platform | Model | Strengths | Weaknesses |
|---|---|---|---|
| PickleballBrackets.com | $2/player service fee | Modern UI, popular in Houston, text messaging | TD-focused, no aggregation, no push notifications, web-only |
| PickleballTournaments.com | $5/event fee | Largest directory (USAPA) | 1990s UI, no search, no mobile app, terrible UX |
| AllPickleballTournaments.com | Free | Closest to aggregator, email alerts | No mobile app, no push notifications, bare-bones directory, relies on manual TD listings |
| Pickleheads | Free + Pro | Largest community, court finder | Focused on courts/open play, NOT tournaments |
| Pickleball Den | $3.50/player | In-app notifications, automated brackets | Only shows tournaments on their own platform |

**Key finding:** Nobody does cross-platform aggregation with push notifications and a native mobile app. This is the gap.

---

## V1 Feature Set

### 1. Tournament Feed (Core)
- Chronological list of upcoming Houston-area tournaments
- Filters: date range, skill level, distance from user, entry fee range, format (round robin, single elim, double elim)
- Each tournament card shows: name, date, location, skill levels, format, entry fee, source platform, registration status (open/filling/full)
- Tap to view detail → registration link opens in-app browser or external browser

### 2. Push Notifications
- New tournament posted matching user preferences (skill level, distance)
- Tournament filling up (if detectable from source)
- Tournament tomorrow reminder (for saved/favorited tournaments)
- User should be able to configure notification preferences

### 3. Share (Viral Loop)
- Every tournament shareable with single tap
- Deep links: `pickleradar.app/t/{tournament_id}` 
- If app installed → opens directly to tournament
- If not installed → mobile web preview showing tournament details + "Get the App" CTA
- Pre-formatted share message: "🏓 [Tournament Name] — [Date] at [Location]. [Skill levels]. [Link]"
- Share targets: iMessage, WhatsApp, text, copy link
- "Share with partner" flow: share a specific tournament with a note like "want to play this together?"
- Share a partner post: "I'm looking for a 4.0 doubles partner for [Tournament] — know anyone?" Links back to the app

### 4. Partner Matching
- Create a post: skill level, availability, optional tournament reference, message
- Browse partner posts filtered by skill level and tournament
- In-app messaging or contact exchange to coordinate
- Shareable partner posts (see Share section)

### 5. Map View
- See upcoming tournaments on a map
- Filter same as feed view
- Tap pin → tournament card → detail view

### 6. Favorites / Saved
- Save tournaments to a personal list
- Drives the "tournament tomorrow" reminder notification

### 7. Manual Tournament Submission
- Simple form: name, date, location, registration link, skill levels, format
- For Facebook group events and word-of-mouth tournaments that scrapers can't reach
- Submitted tournaments go live immediately (moderate later if abuse becomes a problem)

---

## Technical Architecture

### Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Mobile app | React Native (Expo) | Single codebase for iOS + Android, fast iteration |
| Backend | Supabase | Postgres + Auth + Realtime + Edge Functions + Push |
| Scraping | Playwright (Node.js) | Handles JavaScript-rendered sites |
| Push notifications | Expo Push / FCM | Native push via Expo's push service |
| Hosting (scrapers) | VPS (Hetzner or Railway) | Cron-based scraper execution |
| Deep links | Expo Router deep linking + web fallback page | Universal links for share functionality |

### Database Schema

```sql
-- Core tournament data
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_start DATE NOT NULL,
  date_end DATE,
  location_name TEXT NOT NULL,
  location_address TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  skill_levels TEXT[], -- e.g., ['3.0', '3.5', '4.0', '4.5', '5.0', 'open']
  format TEXT, -- 'round_robin', 'single_elim', 'double_elim', 'mixed'
  entry_fee DECIMAL(10, 2),
  registration_url TEXT,
  registration_status TEXT DEFAULT 'open', -- 'open', 'filling', 'full', 'closed'
  source_platform TEXT NOT NULL, -- 'pickleballbrackets', 'pickleballtournaments', 'pickleball_den', 'houston_ssc', 'sportsmonkey', 'manual'
  source_url TEXT,
  source_hash TEXT, -- for change detection
  description TEXT,
  is_manually_submitted BOOLEAN DEFAULT FALSE,
  submitted_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'active', -- 'active', 'cancelled', 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tournaments_date ON tournaments(date_start);
CREATE INDEX idx_tournaments_location ON tournaments USING gist (
  ll_to_earth(latitude, longitude)
); -- for distance queries, requires earthdistance extension
CREATE INDEX idx_tournaments_source ON tournaments(source_platform, source_url);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  name TEXT,
  skill_level TEXT, -- self-reported: '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'
  location_latitude DECIMAL(10, 7),
  location_longitude DECIMAL(10, 7),
  notification_radius_miles INTEGER DEFAULT 50,
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved/favorited tournaments
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tournament_id)
);

-- Partner matching posts
CREATE TABLE partner_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL, -- optional, can be general
  skill_level TEXT NOT NULL,
  message TEXT,
  contact_method TEXT, -- 'in_app', 'phone', 'email'
  contact_info TEXT, -- phone or email if they choose to share
  status TEXT DEFAULT 'active', -- 'active', 'matched', 'expired'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification log
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'new_tournament', 'filling_up', 'reminder', 'partner_match'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Scraper run log (for debugging and monitoring)
CREATE TABLE scraper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running', -- 'running', 'success', 'error'
  tournaments_found INTEGER DEFAULT 0,
  tournaments_new INTEGER DEFAULT 0,
  tournaments_updated INTEGER DEFAULT 0,
  error_message TEXT
);
```

### Notification Preferences (add to users or separate table)

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  new_tournaments BOOLEAN DEFAULT TRUE,
  filling_up BOOLEAN DEFAULT TRUE,
  day_before_reminder BOOLEAN DEFAULT TRUE,
  min_skill_level TEXT, -- only notify for tournaments at or above this level
  max_distance_miles INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Scraping System

### Architecture

Playwright-based scrapers running on a VPS, hitting each source on an hourly cron during development (dial back once stable). Each scraper follows this pipeline:

```
Hit source page → Render JS → Extract tournament data → Hash page content → Compare to stored hash → If changed: parse, normalize, upsert to Postgres → If new tournament: trigger push notification pipeline
```

### Phase 1 Scraping Targets (Houston only)

#### 1. PickleballBrackets.com
- **URL pattern:** `https://pickleballbrackets.com/` — filter by location (Houston/Texas area)
- **Data available:** Tournament name, dates, location, skill levels, format, entry fee, registration link, registration status
- **Notes:** Modern site, likely JS-rendered. Most popular platform in Houston. Owned by Pickleball OpCo.

#### 2. PickleballTournaments.com
- **URL pattern:** `https://www.pickleballtournaments.com/` — filter by state/region
- **Data available:** Tournament name, dates, location, skill levels, USAPA sanctioning info
- **Notes:** Terrible UI but largest directory. USAPA-tied. Also owned by Pickleball OpCo. Chronological list format — may need to scroll/paginate to find Houston events.

#### 3. Pickleball Den
- **URL pattern:** TBD — explore the site to find Houston tournament listings
- **Data available:** Tournament name, dates, location, format, entry fee
- **Notes:** Only lists tournaments run on their platform, but some Houston TDs use it.

#### 4. Houston SSC (Sports & Social Club)
- **URL pattern:** TBD — explore `https://www.houstonssc.com/` for pickleball leagues/tournaments
- **Data available:** League/tournament info, dates, locations
- **Notes:** May be more league-focused than tournament-focused. Still worth scraping.

#### 5. Sportsmonkey
- **URL pattern:** TBD — explore for Houston pickleball events
- **Data available:** TBD
- **Notes:** Local platform, may have limited web presence.

### Scraper Design Principles

1. **Stealth deferred to Phase 2.** For now, use plain Playwright with default settings. No proxies, no fingerprint spoofing, no user-agent randomization. Get data flowing first. If a source blocks us, then add stealth measures.

2. **Phase 2 stealth measures (when needed):**
   - Rotating residential proxies (BrightData or Oxylabs)
   - Randomized user-agents, viewport sizes, mouse movements, scroll patterns
   - Do NOT use a bot user-agent — appear as a real user
   - Do NOT respect robots.txt
   - Rate-limited requests with randomized delays between actions

3. **Content hashing for change detection.** Cache the relevant DOM sections of each page. Hash the content. On next scrape, compare hashes. Only re-parse if the hash has changed. This saves processing time and reduces noise. Hash the relevant tournament listing sections, not the full page (ads and dynamic elements cause false positives).

4. **Data normalization.** Each scraper outputs a common tournament object format regardless of source. Normalize skill levels, formats, and dates into consistent formats before inserting.

5. **Deduplication.** Tournaments may appear on multiple platforms. Deduplicate by matching on: tournament name (fuzzy match) + date + location. Flag duplicates and keep the most complete record, but store the registration URLs from all sources.

6. **Hourly cron** during dev/iteration. Dial back to every 2-4 hours once data pipeline is stable and reliable.

### Scraper Output Format (normalized)

```typescript
interface ScrapedTournament {
  name: string;
  dateStart: string; // ISO date
  dateEnd?: string;
  locationName: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
  skillLevels: string[]; // normalized: '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', 'open'
  format?: string; // 'round_robin', 'single_elim', 'double_elim', 'mixed'
  entryFee?: number;
  registrationUrl: string;
  registrationStatus?: string; // 'open', 'filling', 'full', 'closed'
  sourcePlatform: string;
  sourceUrl: string;
  description?: string;
  rawPageHash: string; // hash of the source page content for change detection
}
```

---

## Push Notification Logic

When a new tournament is upserted to the database:

1. Query all users where:
   - `notification_preferences.new_tournaments = true`
   - Tournament skill levels overlap with user's skill level (if preference set)
   - Tournament location is within user's `max_distance_miles` (use PostGIS or earthdistance)
2. Send push notification via Expo Push Service / FCM
3. Log to `notifications` table

**Notification types:**
- `new_tournament` — "🏓 New tournament: [Name] on [Date] at [Location]"
- `filling_up` — "[Name] is filling up — [X] spots left" (only if registration status is detectable)
- `reminder` — "Reminder: [Name] is tomorrow at [Location]" (for favorited tournaments, send evening before)

---

## Deep Linking & Share System

### URL Structure
- Tournament: `https://pickleradar.app/t/{tournament_id}`
- Partner post: `https://pickleradar.app/p/{partner_post_id}`

### Flow
1. User taps Share on a tournament
2. App generates the deep link URL + pre-formatted share text
3. Native share sheet opens (iMessage, WhatsApp, text, copy)
4. Recipient taps link:
   - **App installed:** Universal link opens app directly to tournament detail
   - **App not installed:** Opens mobile web page showing tournament info + App Store/Play Store CTA

### Web Fallback Page
A simple, mobile-optimized web page (can be a Next.js or static site hosted on Vercel) that:
- Displays tournament name, date, location, skill levels, entry fee
- Shows "Open in PickleRadar" button (deep link attempt)
- Shows "Get PickleRadar" button (App Store / Play Store links)
- Clean, fast, no bloat — this is the first impression for new users

---

## Monetization

Current strategy: monetize the web, email, and local community loop before investing heavily in the native app. The product has evolved from the original mobile-first plan into a web-first tournament discovery and intelligence surface with email digest, manual submissions, admin review, social workflow, and DUPR/event intelligence.

See [`docs/PRODUCT_STRATEGY.md`](docs/PRODUCT_STRATEGY.md) for the current revenue plan.

The priority remains community growth and tournament completeness, but lightweight monetization should now be tested through tournament director and facility distribution:

1. **Sponsored facility placements** — local facilities pay for featured placement ($200-500/mo)
2. **Gear affiliate links** — paddle/shoe recommendations with affiliate tracking
3. **Partner matching premium** — $5-10/mo for advanced matching features
4. **Premium notifications** — instant push for premium users, delayed for free tier
5. **Tournament director distribution** — TDs pay to promote tournaments to targeted players
6. **Facility partnerships** — promoted listings, "book a court" integrations

IMPORTANT: Do NOT take a cut of tournament registration fees. This would discourage platforms from allowing their tournaments to appear on the app, directly undermining the core value proposition of having ALL tournaments.

---

## Development Phases

### Phase 1: Data Pipeline (START HERE)
- [ ] Set up Supabase project (schema, auth, extensions)
- [ ] Build PickleballBrackets scraper (Playwright, Houston filter)
- [ ] Build PickleballTournaments scraper
- [ ] Build normalized data pipeline (scrape → parse → deduplicate → upsert)
- [ ] Hash-based change detection
- [ ] Manual tournament submission endpoint (Supabase Edge Function or simple API)
- [ ] Scraper run logging
- [ ] Hourly cron setup

### Phase 2: App Shell
- [ ] Expo React Native project setup
- [ ] Supabase client integration (auth, data fetching)
- [ ] Tournament feed screen with filters
- [ ] Tournament detail screen
- [ ] Map view
- [ ] Favorites/save functionality

### Phase 3: Notifications & Share
- [ ] Push notification registration (Expo Push)
- [ ] Notification preferences screen
- [ ] New tournament notification trigger
- [ ] Reminder notification (day before favorited tournament)
- [ ] Share functionality with deep links
- [ ] Web fallback page for deep links

### Phase 4: Partner Matching
- [ ] Partner post creation screen
- [ ] Partner post browse/search screen
- [ ] Share partner posts
- [ ] Contact exchange flow

### Phase 5: Remaining Scrapers + Stealth
- [ ] Pickleball Den scraper
- [ ] Houston SSC scraper
- [ ] Sportsmonkey scraper
- [ ] Rotating residential proxies (BrightData/Oxylabs)
- [ ] Randomized user-agents, viewports, mouse movements
- [ ] Real-user fingerprinting (no bot user-agent)
- [ ] Ignore robots.txt

### Phase 6: Polish & Launch
- [ ] Onboarding flow (skill level, location, notification preferences)
- [ ] App Store / Play Store submission
- [ ] Landing page (pickleradar.app)
- [ ] Beta distribution to Houston pickleball community

---

## Design Direction

- Clean, modern, fast. Think "the anti-PickleballTournaments.com"
- Tournament cards should be scannable — key info visible without tapping in
- Filters should be accessible but not overwhelming
- Map view as a first-class citizen, not an afterthought
- Share buttons prominent on every tournament card and detail view
- Dark mode support (many players check phones at outdoor courts in sunlight — consider high contrast)

---

## Key Technical Decisions & Rationale

1. **React Native (Expo) over Flutter or native:** Ben's strongest stack is React/TypeScript. Expo handles push notifications, deep linking, and app store deployment with minimal config. Single codebase for both platforms.

2. **Supabase over custom backend:** Auth, Postgres, realtime subscriptions, edge functions, and push notification infrastructure out of the box. No need to build and maintain a custom API layer for v1.

3. **Playwright over Puppeteer/Cheerio:** Some target sites are JS-rendered (PickleballBrackets). Playwright handles this natively and has better API ergonomics than Puppeteer.

4. **Scraping over API integrations:** None of these platforms offer public APIs. Scraping is the only option for aggregation. This is the Kayak model — we don't host registration, we point users to the source.

5. **Houston-only launch:** Manageable scope for validation. Ben can personally seed the community through his tournament network. Proves the model before expanding.

---

## Out of Scope for V1

- User accounts beyond basic auth (no social profiles, no game history)
- Rating tracking or integration (DUPR, UTPR, etc.)
- Tournament results or bracket tracking
- League management
- Court finder (Pickleheads owns this)
- Any monetization features
- National/multi-city expansion
- Admin dashboard (use Supabase dashboard directly)
