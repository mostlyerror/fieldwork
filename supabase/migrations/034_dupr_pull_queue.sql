-- One shared DUPR pull queue (docs/dupr-metered-layer.md §2.3).
--
-- Replaces the two competing selectors — get_roster_players_to_refresh
-- (migration 031, roster-priority) and the matches_last_checked staleness scan
-- in fetchAllMatchHistory — with a single ranked queue every job drains:
--
--   tier 1: rostered in a current/recent tournament AND competed since their
--           last pull (or never pulled) — known-unfetched matches, first out
--   tier 2: rostered, everyone else past the fresh floor
--   tier 3: not rostered, matches stale (> stale_days) — general freshness
--
-- All gated by the 24h fresh floor. Returns the cached dupr_numeric_id so
-- repeat pulls skip the search request (migration 032).

CREATE OR REPLACE FUNCTION get_dupr_pull_queue(
  post_event_days INT,
  fresh_floor_hours INT,
  stale_days INT,
  lim INT
)
RETURNS TABLE (id UUID, name TEXT, dupr_id TEXT, dupr_numeric_id BIGINT)
LANGUAGE sql
STABLE
AS $$
  WITH roster AS (
    -- Most recent current/recent-tournament event date per rostered player
    SELECT pid, max(last_event) AS last_event
    FROM (
      SELECT ep.player_id AS pid, COALESCE(t.date_end, t.date_start) AS last_event
      FROM event_players ep
      JOIN tournament_events te ON te.id = ep.event_id
      JOIN tournaments t ON t.id = te.tournament_id
      WHERE t.status = 'active'
        AND COALESCE(t.date_end, t.date_start) >= current_date - post_event_days
        AND ep.player_id IS NOT NULL
      UNION ALL
      SELECT ep.partner_id, COALESCE(t.date_end, t.date_start)
      FROM event_players ep
      JOIN tournament_events te ON te.id = ep.event_id
      JOIN tournaments t ON t.id = te.tournament_id
      WHERE t.status = 'active'
        AND COALESCE(t.date_end, t.date_start) >= current_date - post_event_days
        AND ep.partner_id IS NOT NULL
    ) u
    GROUP BY pid
  )
  SELECT p.id, p.name, p.dupr_id, p.dupr_numeric_id
  FROM players p
  LEFT JOIN roster r ON r.pid = p.id
  WHERE p.dupr_id IS NOT NULL
    AND p.dupr_verified = true
    AND (
      p.matches_last_checked IS NULL
      OR p.matches_last_checked < now() - make_interval(hours => fresh_floor_hours)
    )
    AND (
      r.pid IS NOT NULL
      OR p.matches_last_checked IS NULL
      OR p.matches_last_checked < now() - make_interval(days => stale_days)
    )
  ORDER BY
    -- Tier 1: rostered AND competed since last pull (or never pulled).
    (r.pid IS NOT NULL
      AND (p.matches_last_checked IS NULL OR p.matches_last_checked::date < r.last_event)) DESC,
    -- Tier 2: rostered at all.
    (r.pid IS NOT NULL) DESC,
    -- Tier 3: oldest data first.
    p.matches_last_checked ASC NULLS FIRST
  LIMIT lim;
$$;
