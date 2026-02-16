-- Enable required extensions for distance calculations
create extension if not exists cube;
create extension if not exists earthdistance;

-- RPC function to find tournaments within a radius of a center point
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
    and date_start >= current_date
    and earth_distance(
         ll_to_earth(center_lat, center_lng),
         ll_to_earth(latitude, longitude)
       ) <= radius_miles * 1609.34
  order by date_start asc;
$$ language sql stable;
