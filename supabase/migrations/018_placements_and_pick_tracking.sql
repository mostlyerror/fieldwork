-- Add placement to event_players (1=gold, 2=silver, 3=bronze)
alter table event_players add column if not exists placement smallint;

-- Track which result card style users download/share
create table if not exists result_card_picks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references tournament_events(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  style text not null,
  created_at timestamptz default now()
);

alter table result_card_picks enable row level security;
create policy "Public insert" on result_card_picks for insert with check (true);
create policy "Public read" on result_card_picks for select using (true);
