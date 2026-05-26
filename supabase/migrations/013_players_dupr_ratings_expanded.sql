ALTER TABLE players
  RENAME COLUMN dupr_rating TO dupr_doubles;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS dupr_doubles_verified DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS dupr_doubles_provisional BOOLEAN,
  ADD COLUMN IF NOT EXISTS dupr_singles DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS dupr_singles_verified DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS dupr_singles_provisional BOOLEAN;

COMMENT ON COLUMN players.dupr_doubles IS 'Overall doubles rating from DUPR (may include provisional)';
COMMENT ON COLUMN players.dupr_doubles_verified IS 'Verified doubles rating (only from validated results)';
COMMENT ON COLUMN players.dupr_singles IS 'Overall singles rating from DUPR';
COMMENT ON COLUMN players.dupr_singles_verified IS 'Verified singles rating (only from validated results)';
