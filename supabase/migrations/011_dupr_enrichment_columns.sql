-- Add columns to track live DUPR lookups
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS dupr_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dupr_last_checked TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_players_dupr_last_checked
  ON players (dupr_last_checked ASC NULLS FIRST);
