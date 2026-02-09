-- Email subscribers for weekly digest notifications
create table if not exists public.email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_email_subscribers_email on public.email_subscribers (email);
create index idx_email_subscribers_status on public.email_subscribers (status);

-- RLS
alter table public.email_subscribers enable row level security;

-- Allow anyone to insert (email capture from homepage)
create policy "Anyone can subscribe" on public.email_subscribers
  for insert with check (true);

-- Service role has full access by default (bypasses RLS)
