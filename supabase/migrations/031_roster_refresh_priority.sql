-- Fix the roster-refresh ordering so players who JUST competed get pulled first.
--
-- Before: ORDER BY matches_last_checked ASC NULLS FIRST. A player who was last
-- pulled before their most recent tournament (i.e. has brand-new, unfetched
-- matches) sat behind every never-checked player in the queue, so at 5/hr they
-- waited days — their partners/results never showed up promptly after an event.
--
-- After: prioritize players whose most-recent rostered tournament ended AFTER
-- their last pull (or who've never been pulled). Those have known-unfetched
-- matches and jump ahead; everyone else falls back to staleness order. This
-- makes the queue self-heal after every tournament without manual resets.

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
  ORDER BY
    -- TRUE = has a competed event newer than the last pull (or never pulled).
    -- Postgres sorts TRUE before FALSE under DESC, so these come first.
    (
      p.matches_last_checked IS NULL
      OR p.matches_last_checked::date < (
        SELECT max(COALESCE(t.date_end, t.date_start))
        FROM event_players ep
        JOIN tournament_events te ON te.id = ep.event_id
        JOIN tournaments t ON t.id = te.tournament_id
        WHERE (ep.player_id = p.id OR ep.partner_id = p.id)
          AND t.status = 'active'
          AND COALESCE(t.date_end, t.date_start) >= current_date - post_event_days
      )
    ) DESC,
    p.matches_last_checked ASC NULLS FIRST
  LIMIT lim;
$$;
