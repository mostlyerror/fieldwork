-- Players whose DUPR history the roster-driven refresh should pull next:
-- rostered in a current/recent tournament (active status, ended within
-- post_event_days — TDs enter results late), verified with a dupr_id, and not
-- fetched within fresh_floor_hours. Server-side join so we don't ship a
-- thousand-UUID IN-list over the wire. Returns the stalest (or never-fetched)
-- first, capped at `lim`.

CREATE OR REPLACE FUNCTION get_roster_players_to_refresh(
  post_event_days INT,
  fresh_floor_hours INT,
  lim INT
)
RETURNS TABLE (id UUID, name TEXT, dupr_id TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT p.id, p.name, p.dupr_id
  FROM players p
  WHERE p.dupr_id IS NOT NULL
    AND p.dupr_verified = true
    AND (
      p.matches_last_checked IS NULL
      OR p.matches_last_checked < now() - make_interval(hours => fresh_floor_hours)
    )
    AND EXISTS (
      SELECT 1
      FROM event_players ep
      JOIN tournament_events te ON te.id = ep.event_id
      JOIN tournaments t ON t.id = te.tournament_id
      WHERE (ep.player_id = p.id OR ep.partner_id = p.id)
        AND t.status = 'active'
        AND COALESCE(t.date_end, t.date_start) >= current_date - post_event_days
    )
  ORDER BY p.matches_last_checked ASC NULLS FIRST
  LIMIT lim;
$$;
