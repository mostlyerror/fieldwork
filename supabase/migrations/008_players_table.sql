-- =============================================================================
-- 008: Players table & event_players FK linkage
--
-- Persistent player identity across tournaments. Deduplicates by PBB playerId.
-- =============================================================================

-- Enable pg_trgm for fuzzy name search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- Players table
-- =============================================================================

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_player_id TEXT UNIQUE NOT NULL,       -- PBB playerId UUID, dedup key
  source_platform TEXT NOT NULL DEFAULT 'pickleballbrackets',
  name TEXT NOT NULL,
  slug TEXT,
  location TEXT,                               -- e.g. "Houston, TX"
  gender TEXT,
  dupr_rating DECIMAL(4,2),                    -- latest known rating
  dupr_active BOOLEAN DEFAULT false,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- claimed by user
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes on players
-- =============================================================================

CREATE INDEX idx_players_name ON players USING gin (name gin_trgm_ops);
CREATE INDEX idx_players_user ON players(user_id);
CREATE INDEX idx_players_source ON players(source_platform, source_player_id);

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_select" ON players FOR SELECT USING (true);

-- =============================================================================
-- Updated_at trigger
-- =============================================================================

CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- Alter event_players — add FK columns to players
-- =============================================================================

ALTER TABLE event_players
  ADD COLUMN player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN partner_id UUID REFERENCES players(id) ON DELETE SET NULL;

CREATE INDEX idx_event_players_player ON event_players(player_id);
CREATE INDEX idx_event_players_partner ON event_players(partner_id);
