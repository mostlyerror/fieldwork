-- DUPR Skill Rating Intelligence
-- Adds event-level breakdown and player data for field strength analysis.

-- =============================================================================
-- Extend users table with DUPR rating fields
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dupr_rating_singles DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS dupr_rating_doubles DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS dupr_profile_url TEXT,
  ADD COLUMN IF NOT EXISTS dupr_last_synced TIMESTAMPTZ;

-- =============================================================================
-- Tournament events (individual brackets within a tournament)
-- =============================================================================

CREATE TABLE tournament_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_type TEXT,            -- singles, doubles, mixed
  gender TEXT,                -- men, women, mixed, open
  skill_level_min DECIMAL(3,1),
  skill_level_max DECIMAL(3,1),
  max_teams INT,
  registered_count INT DEFAULT 0,
  avg_dupr DECIMAL(4,2),
  field_strength DECIMAL(3,2),   -- 0.00-1.00
  sandbagger_pct DECIMAL(3,2),   -- 0.00-1.00
  source_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Event players (registered players per event with DUPR ratings)
-- =============================================================================

CREATE TABLE event_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES tournament_events(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  dupr_rating DECIMAL(4,2),
  partner_name TEXT,
  partner_dupr_rating DECIMAL(4,2),
  team_avg_dupr DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX idx_tournament_events_tournament ON tournament_events(tournament_id);
CREATE INDEX idx_tournament_events_skill ON tournament_events(skill_level_min, skill_level_max);
CREATE INDEX idx_event_players_event ON event_players(event_id);
CREATE INDEX idx_event_players_name ON event_players(player_name);
CREATE INDEX idx_event_players_dupr ON event_players(dupr_rating);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE tournament_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_players ENABLE ROW LEVEL SECURITY;

-- Public read, service role write (scrapers use service key)
CREATE POLICY "tournament_events_select" ON tournament_events
  FOR SELECT USING (true);

CREATE POLICY "event_players_select" ON event_players
  FOR SELECT USING (true);

-- =============================================================================
-- Triggers
-- =============================================================================

CREATE TRIGGER tournament_events_updated_at
  BEFORE UPDATE ON tournament_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
