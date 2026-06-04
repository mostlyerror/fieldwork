-- Player DUPR rating timeline. One row per (player, match): the player's
-- post-match rating, the pre-match rating, and the impact (delta) that match
-- had. Built during the match-history fetch from the postMatchRating /
-- preMatchRatingAndImpact fields DUPR already returns per match — no extra
-- scrape. Powers the rating-trend chart on player pages (+ future Wrapped).

CREATE TABLE IF NOT EXISTS player_rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  dupr_match_id BIGINT NOT NULL,
  event_date DATE NOT NULL,
  format TEXT NOT NULL DEFAULT 'DOUBLES',
  rating DECIMAL(5, 3) NOT NULL,   -- rating AFTER this match
  pre_rating DECIMAL(7, 5),        -- rating BEFORE this match
  impact DECIMAL(9, 7),            -- rating delta from this match
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id, dupr_match_id, format)
);

CREATE INDEX IF NOT EXISTS idx_prh_player_date
  ON player_rating_history (player_id, event_date);

ALTER TABLE player_rating_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_rating_history_public_read
  ON player_rating_history FOR SELECT USING (true);
