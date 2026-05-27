-- Snapshot live DUPR at enrichment time so historical tournaments show the rating
-- the player had when they registered, not their current rating.
alter table event_players add column if not exists enriched_dupr numeric(4,2);
alter table event_players add column if not exists enriched_dupr_verified boolean;
alter table event_players add column if not exists partner_enriched_dupr numeric(4,2);
alter table event_players add column if not exists partner_enriched_dupr_verified boolean;
alter table event_players add column if not exists enriched_at timestamptz;
