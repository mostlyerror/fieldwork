-- PickleRadar Initial Schema Migration
-- Enables required extensions, creates all tables, indexes, RLS policies, and realtime.

-- =============================================================================
-- Extensions
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "cube";
CREATE EXTENSION IF NOT EXISTS "earthdistance";

-- =============================================================================
-- Tables
-- =============================================================================

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  name TEXT,
  skill_level TEXT,
  location_latitude DECIMAL(10, 7),
  location_longitude DECIMAL(10, 7),
  notification_radius_miles INTEGER DEFAULT 50,
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  skill_levels TEXT[],
  format TEXT,
  entry_fee DECIMAL(10, 2),
  registration_url TEXT,
  registration_status TEXT DEFAULT 'open',
  source_platform TEXT NOT NULL,
  source_url TEXT,
  source_hash TEXT,
  description TEXT,
  is_manually_submitted BOOLEAN DEFAULT FALSE,
  submitted_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'active',
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
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  skill_level TEXT NOT NULL,
  message TEXT,
  contact_method TEXT,
  contact_info TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification log
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Scraper run log
CREATE TABLE scraper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  tournaments_found INTEGER DEFAULT 0,
  tournaments_new INTEGER DEFAULT 0,
  tournaments_updated INTEGER DEFAULT 0,
  error_message TEXT
);

-- Notification preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  new_tournaments BOOLEAN DEFAULT TRUE,
  filling_up BOOLEAN DEFAULT TRUE,
  day_before_reminder BOOLEAN DEFAULT TRUE,
  min_skill_level TEXT,
  max_distance_miles INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX idx_tournaments_date ON tournaments(date_start);
CREATE INDEX idx_tournaments_location ON tournaments USING gist (
  ll_to_earth(latitude, longitude)
);
CREATE INDEX idx_tournaments_source ON tournaments(source_platform, source_url);
CREATE INDEX idx_tournaments_status ON tournaments(status);

CREATE INDEX idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_tournament ON user_favorites(tournament_id);

CREATE INDEX idx_partner_posts_user ON partner_posts(user_id);
CREATE INDEX idx_partner_posts_tournament ON partner_posts(tournament_id);
CREATE INDEX idx_partner_posts_status ON partner_posts(status);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_tournament ON notifications(tournament_id);

CREATE INDEX idx_scraper_runs_platform ON scraper_runs(source_platform);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;

-- Tournaments: anyone can read, only service role can write (scrapers use service key)
CREATE POLICY "tournaments_select" ON tournaments
  FOR SELECT USING (true);

-- Users: users can read/update their own row
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User favorites: users read/write their own
CREATE POLICY "favorites_select_own" ON user_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "favorites_insert_own" ON user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favorites_delete_own" ON user_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Partner posts: anyone can read active posts, users write their own
CREATE POLICY "partner_posts_select_active" ON partner_posts
  FOR SELECT USING (status = 'active');

CREATE POLICY "partner_posts_insert_own" ON partner_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "partner_posts_update_own" ON partner_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "partner_posts_delete_own" ON partner_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Notifications: users read their own
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Notification preferences: users read/write their own
CREATE POLICY "notification_prefs_select_own" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_prefs_insert_own" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_prefs_update_own" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Scraper runs: read-only for authenticated users (monitoring), service role writes
CREATE POLICY "scraper_runs_select" ON scraper_runs
  FOR SELECT USING (true);

-- =============================================================================
-- Realtime
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;

-- =============================================================================
-- Updated_at trigger function
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER partner_posts_updated_at
  BEFORE UPDATE ON partner_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
