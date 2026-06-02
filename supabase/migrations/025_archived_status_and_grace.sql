-- Archived tournament lifecycle + 30-day discovery grace window.
--
-- 1. Past tournaments stay discoverable for 30 days after they end, so people
--    can still find recent events for results. The `tournaments_near` RPC (the
--    city/search surface) previously cut them off at `current_date`.
-- 2. `archive_past_tournaments()` retires active tournaments that ended more than
--    30 days ago into the 'archived' status — pulled off discovery but still
--    reachable by direct link and present in player histories. Called by the
--    scraper each run; also used once for the initial backfill.

create or replace function tournaments_near(
  center_lat double precision,
  center_lng double precision,
  radius_miles double precision
)
returns setof tournaments as $$
  select *
  from tournaments
  where latitude is not null
    and longitude is not null
    and status = 'active'
    and coalesce(date_end, date_start) >= current_date - interval '30 days'
    and earth_distance(
         ll_to_earth(center_lat, center_lng),
         ll_to_earth(latitude, longitude)
       ) <= radius_miles * 1609.34
  order by date_start asc;
$$ language sql stable;

create or replace function archive_past_tournaments()
returns integer as $$
declare
  archived_count integer;
begin
  update tournaments
     set status = 'archived'
   where status = 'active'
     and coalesce(date_end, date_start) < current_date - interval '30 days';
  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$ language plpgsql;
