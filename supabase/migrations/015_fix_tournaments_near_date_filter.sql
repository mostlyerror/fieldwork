-- Fix: include in-progress tournaments (multi-day events where date_start < today but date_end >= today)
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
    and coalesce(date_end, date_start) >= current_date
    and earth_distance(
         ll_to_earth(center_lat, center_lng),
         ll_to_earth(latitude, longitude)
       ) <= radius_miles * 1609.34
  order by date_start asc;
$$ language sql stable;
