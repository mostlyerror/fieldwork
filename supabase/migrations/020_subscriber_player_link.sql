-- Private email↔player linker.
-- The link is internal-only — it controls what the subscriber personally
-- receives (alerts about their tournaments, rating changes). No public
-- attribution at v1.

alter table email_subscribers add column if not exists name text;
alter table email_subscribers add column if not exists player_id uuid references players(id) on delete set null;
alter table email_subscribers add column if not exists linked_at timestamptz;
alter table email_subscribers add column if not exists link_status text default 'unattempted'
  check (link_status in ('unattempted', 'linked', 'ambiguous', 'no_match'));

create index if not exists idx_email_subscribers_player on email_subscribers(player_id) where player_id is not null;
