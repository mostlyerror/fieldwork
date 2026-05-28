-- Smart tourney alert tracking.
-- One row per (subscriber, tournament) — prevents re-alerting on the same one.
create table if not exists tournament_alerts_sent (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references email_subscribers(id) on delete cascade,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  sent_at timestamptz not null default now(),
  reasons text[] not null default '{}',
  score numeric not null
);

create unique index if not exists idx_tournament_alerts_unique
  on tournament_alerts_sent(subscriber_id, tournament_id);
create index if not exists idx_tournament_alerts_sent_at
  on tournament_alerts_sent(sent_at);

alter table tournament_alerts_sent enable row level security;

-- Opt-out: defaults to true (everyone gets them) but subscribers can disable.
alter table email_subscribers add column if not exists wants_smart_alerts boolean not null default true;
