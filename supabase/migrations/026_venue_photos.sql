-- Venue photos on the grid.
--
-- venues.photo_url already exists (024) and flows to the tournament DETAIL page
-- via getTournament's venue join. But the city/search GRID uses the
-- tournaments_near RPC, which returns raw `tournaments` rows with NO venue join.
-- So denormalize the photo onto tournaments.venue_photo_url — it then rides along
-- the RPC's `setof tournaments` and getTournament's `select *` for free.
--
-- sync_tournament_venue_photos() keeps the denormalized copy current; it's run by
-- the scraper each cycle and once by the photo backfill.

alter table tournaments add column if not exists venue_photo_url text;

create or replace function sync_tournament_venue_photos()
returns integer as $$
declare
  synced_count integer;
begin
  update tournaments t
     set venue_photo_url = v.photo_url
    from venues v
   where t.venue_id = v.id
     and t.venue_photo_url is distinct from v.photo_url;
  get diagnostics synced_count = row_count;
  return synced_count;
end;
$$ language plpgsql;
