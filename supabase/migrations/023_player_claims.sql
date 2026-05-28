-- Audit trail for explicit player claims.
-- Created when a user picks a candidate via /profile/find and we send the
-- confirmation email. Marked confirmed when they click the link.

create table if not exists player_claims (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references email_subscribers(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  token text not null unique,
  claimed_via text not null default 'email_confirm',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  confirmed_at timestamptz
);

create index if not exists idx_player_claims_token on player_claims(token);
create index if not exists idx_player_claims_subscriber on player_claims(subscriber_id);

alter table player_claims enable row level security;
-- No public read/write — only the server (service role) touches this.

comment on table player_claims is
  'One row per claim attempt. Created when a subscriber picks a candidate; marked confirmed when the email link is clicked. The confirmed claim sets email_subscribers.player_id.';
