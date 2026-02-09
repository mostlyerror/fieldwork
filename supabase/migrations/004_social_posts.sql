-- Social posts queue for Instagram digest workflow
create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  post_type text not null default 'digest',
  status text not null default 'queued' check (status in ('queued', 'published', 'rejected', 'failed')),
  platform text not null default 'instagram',
  caption text not null,
  image_url text not null,
  metadata jsonb default '{}',
  published_at timestamptz,
  platform_media_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_social_posts_status on social_posts (status);
create index idx_social_posts_created_at on social_posts (created_at desc);

-- RLS
alter table social_posts enable row level security;

create policy "Public can read social posts"
  on social_posts for select
  using (true);

-- Service role handles all writes (server actions use service role key)
