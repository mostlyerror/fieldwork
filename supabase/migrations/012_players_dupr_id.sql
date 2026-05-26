ALTER TABLE players
  ADD COLUMN IF NOT EXISTS dupr_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_dupr_id
  ON players (dupr_id)
  WHERE dupr_id IS NOT NULL;
