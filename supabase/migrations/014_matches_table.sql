CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dupr_match_id BIGINT UNIQUE NOT NULL,
  event_date DATE NOT NULL,
  event_format TEXT NOT NULL,
  league TEXT,
  venue TEXT,

  team1_player1_id UUID REFERENCES players(id),
  team1_player2_id UUID REFERENCES players(id),
  team1_player1_name TEXT NOT NULL,
  team1_player2_name TEXT,

  team2_player1_id UUID REFERENCES players(id),
  team2_player2_id UUID REFERENCES players(id),
  team2_player1_name TEXT NOT NULL,
  team2_player2_name TEXT,

  game1_team1 SMALLINT,
  game1_team2 SMALLINT,
  game2_team1 SMALLINT,
  game2_team2 SMALLINT,
  game3_team1 SMALLINT,
  game3_team2 SMALLINT,

  team1_won BOOLEAN NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_t1p1 ON matches (team1_player1_id);
CREATE INDEX idx_matches_t1p2 ON matches (team1_player2_id);
CREATE INDEX idx_matches_t2p1 ON matches (team2_player1_id);
CREATE INDEX idx_matches_t2p2 ON matches (team2_player2_id);
CREATE INDEX idx_matches_date ON matches (event_date DESC);

ALTER TABLE players ADD COLUMN IF NOT EXISTS matches_last_checked TIMESTAMPTZ;

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY matches_public_read ON matches FOR SELECT USING (true);
