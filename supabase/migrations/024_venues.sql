-- 024_venues.sql
-- Deduped, first-class venue entity. Canonical identity = Google place_id,
-- resolved once at ingest. Nullable place_id + always-set dedup_key so nothing
-- is dropped when Places cannot resolve a location.

CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT UNIQUE,
  dedup_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  formatted_address TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  city_slug TEXT,
  photo_url TEXT,          -- v2 (Places Photo), never written in v1
  website TEXT,            -- v2, never written in v1
  source TEXT NOT NULL DEFAULT 'places',  -- 'places' | 'fallback'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_venues_geo ON venues USING gist (ll_to_earth(latitude, longitude));
CREATE INDEX idx_venues_city ON venues(city_slug);
CREATE INDEX idx_venues_slug ON venues(slug);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venues_select" ON venues FOR SELECT USING (true);

CREATE TRIGGER venues_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tournaments
  ADD COLUMN venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;
CREATE INDEX idx_tournaments_venue ON tournaments(venue_id);

CREATE OR REPLACE FUNCTION find_nearby_venue(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_max_distance_meters DOUBLE PRECISION
)
RETURNS TABLE(id UUID, name TEXT, slug TEXT, distance_meters DOUBLE PRECISION) AS $$
BEGIN
  RETURN QUERY
    SELECT v.id, v.name, v.slug,
           earth_distance(ll_to_earth(v.latitude, v.longitude),
                          ll_to_earth(p_lat, p_lng)) AS distance_meters
    FROM venues v
    WHERE v.latitude IS NOT NULL AND v.longitude IS NOT NULL
      AND earth_distance(ll_to_earth(v.latitude, v.longitude),
                         ll_to_earth(p_lat, p_lng)) < p_max_distance_meters
    ORDER BY earth_distance(ll_to_earth(v.latitude, v.longitude),
                            ll_to_earth(p_lat, p_lng))
    LIMIT 5;
END;
$$ LANGUAGE plpgsql STABLE;
