-- Cross-platform tournament deduplication
-- Adds canonical_id pointer, tournament_sources join table,
-- find_nearby_tournament RPC, and scraper_runs dedup counter.

-- =============================================================================
-- canonical_id on tournaments
-- =============================================================================

ALTER TABLE tournaments
  ADD COLUMN canonical_id UUID REFERENCES tournaments(id) ON DELETE SET NULL;

CREATE INDEX idx_tournaments_canonical ON tournaments(canonical_id)
  WHERE canonical_id IS NOT NULL;

-- =============================================================================
-- tournament_sources join table
-- =============================================================================

CREATE TABLE tournament_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  source_platform TEXT NOT NULL,
  source_url TEXT,
  registration_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, source_platform, source_url)
);

ALTER TABLE tournament_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tournament_sources_select" ON tournament_sources FOR SELECT USING (true);

-- =============================================================================
-- find_nearby_tournament RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION find_nearby_tournament(
  p_date_start DATE,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_max_distance_meters DOUBLE PRECISION
)
RETURNS TABLE(id UUID, name TEXT) AS $$
BEGIN
  RETURN QUERY
    SELECT t.id, t.name
    FROM tournaments t
    WHERE t.date_start = p_date_start
      AND t.canonical_id IS NULL
      AND t.latitude IS NOT NULL
      AND t.longitude IS NOT NULL
      AND earth_distance(
            ll_to_earth(t.latitude, t.longitude),
            ll_to_earth(p_lat, p_lng)
          ) < p_max_distance_meters
    ORDER BY earth_distance(
               ll_to_earth(t.latitude, t.longitude),
               ll_to_earth(p_lat, p_lng)
             )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- scraper_runs dedup counter
-- =============================================================================

ALTER TABLE scraper_runs ADD COLUMN tournaments_deduplicated INTEGER DEFAULT 0;
