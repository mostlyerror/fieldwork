-- Registration close date for urgency UI
alter table tournaments add column if not exists registration_close_date timestamptz;

-- Tournament logo URL (from PBB search API)
alter table tournaments add column if not exists logo_url text;

-- Venue website (e.g., casapickle.com)
alter table tournaments add column if not exists venue_website text;
