-- Stored DUPR session, so jobs stop logging in every run.
--
-- Since 2026-09-08 DUPR answers a fresh login with HTTP 428 and emails a
-- sign-in code. Every job logged in fresh, so none of them could work. Now Ben
-- verifies once by hand (`npm run dupr:login` in packages/scrapers), the token
-- lands here, and getDuprToken() reads it before trying to log in.
--
-- One row only (id = 1). Holds live credentials, so it must never reach the
-- Data API: RLS on with no policies, and anon/authenticated lose every grant.
-- The scrapers use the service-role client, which bypasses RLS.

create table if not exists public.dupr_session (
  id            int primary key default 1 check (id = 1),
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  updated_at    timestamptz not null default now()
);

alter table public.dupr_session enable row level security;
revoke all on public.dupr_session from anon, authenticated;
grant select, insert, update on public.dupr_session to service_role;
