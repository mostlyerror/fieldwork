-- Live tournament match data from PBBrackets getMatchInfos API
create table if not exists tournament_matches (
  id uuid primary key default gen_random_uuid(),
  match_uuid text not null unique,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  event_id uuid references tournament_events(id) on delete set null,

  -- Teams
  team1_player1_name text,
  team1_player2_name text,
  team2_player1_name text,
  team2_player2_name text,
  team1_player1_uuid text,
  team1_player2_uuid text,
  team2_player1_uuid text,
  team2_player2_uuid text,
  team1_rating numeric(4,2),
  team2_rating numeric(4,2),
  team1_seed int,
  team2_seed int,

  -- Scores (up to 5 games)
  team1_scores int[] default '{}',
  team2_scores int[] default '{}',

  -- Result
  winner smallint default 0, -- 0=pending, 1=team1, 2=team2
  match_status smallint default 1,

  -- Structure
  round_number int,
  match_number int,
  round_text text,
  bracket_type text, -- 'RR', 'B' (bracket), 'SE' (single elim)
  pool_id text,

  -- Court & timing
  court_title text,
  planned_start timestamptz,
  match_start timestamptz,
  match_completed timestamptz,

  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_tournament_matches_tournament on tournament_matches(tournament_id);
create index idx_tournament_matches_event on tournament_matches(event_id);
create index idx_tournament_matches_status on tournament_matches(winner) where winner = 0;

-- RLS: public read
alter table tournament_matches enable row level security;
create policy "Public read" on tournament_matches for select using (true);
