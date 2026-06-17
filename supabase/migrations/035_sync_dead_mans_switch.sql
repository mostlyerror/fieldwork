-- Independent sync-pipeline dead-man's-switch.
--
-- Why: on 2026-06-15 a GitHub Actions billing failure silently stopped every
-- sync cron (scrape, urgent-refresh, placements). Nothing alerted, because the
-- health-check ALSO ran on GitHub Actions — the watchman died with the pipeline.
-- Data drifted from source for ~2 days before anyone noticed.
--
-- This monitor lives entirely inside Postgres: pg_cron checks freshness every
-- 30 min and posts to Discord via pg_net. It is independent of both GitHub
-- Actions and Vercel, so it survives an outage of the infra it watches.
--
-- Freshness signal: the existing scraper_runs log. Each cron already records a
-- `status='success'` row on completion, so a stale "last success" per lane = a
-- dead pipeline. No scraper code changes needed.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Lanes we expect to stay alive, with their staleness thresholds (cadence + grace).
create table if not exists public.sync_monitor_targets (
  source_platform text primary key,        -- matches scraper_runs.source_platform
  label           text        not null,
  stale_after     interval    not null,
  alerting        boolean      not null default false,
  last_alerted_at timestamptz
);

-- Operational table — never reaches the Data API. RLS on + no policy denies
-- anon/authenticated; service_role bypasses RLS for ops/verification.
alter table public.sync_monitor_targets enable row level security;
grant select, update on public.sync_monitor_targets to service_role;

insert into public.sync_monitor_targets (source_platform, label, stale_after) values
  ('urgent_refresh',     'Urgent refresh (hourly)', interval '3 hours'),
  ('pickleballbrackets', 'Full scrape (2x/day)',    interval '18 hours')
on conflict (source_platform)
  do update set label = excluded.label, stale_after = excluded.stale_after;

-- Discord poster. Reads the webhook from Vault (never committed to the repo).
-- Kept private: revoked from public, only ever called by check_sync_health.
create or replace function public._sync_alert(webhook text, msg text)
returns void
language plpgsql
security definer
set search_path = public, net
as $$
begin
  if webhook is null then
    raise notice 'sync-health: no discord_webhook_url in vault; would have sent: %', msg;
    return;
  end if;
  perform net.http_post(
    url     := webhook,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := jsonb_build_object('content', msg)
  );
end;
$$;

-- The check: for each lane, find the newest successful run; alert on transition
-- to stale, re-nudge every 6h while down, and post a recovery when it returns.
create or replace function public.check_sync_health()
returns void
language plpgsql
security definer
set search_path = public, net, vault, cron
as $$
declare
  t        record;
  webhook  text;
  last_ok  timestamptz;
  is_stale boolean;
begin
  select decrypted_secret into webhook
  from vault.decrypted_secrets
  where name = 'discord_webhook_url'
  limit 1;

  for t in select * from public.sync_monitor_targets loop
    select max(completed_at) into last_ok
    from public.scraper_runs
    where source_platform = t.source_platform and status = 'success';

    is_stale := last_ok is null or now() - last_ok > t.stale_after;

    if is_stale and not t.alerting then
      perform public._sync_alert(
        webhook,
        format(
          '🚨 **Sync stale: %s** — last success %s. Threshold %s. Pipeline may be down (check GitHub Actions / billing).',
          t.label,
          coalesce(
            to_char(last_ok at time zone 'UTC', 'Mon DD HH24:MI') || ' UTC (' || justify_interval(now() - last_ok) || ' ago)',
            'never'),
          t.stale_after));
      update public.sync_monitor_targets
        set alerting = true, last_alerted_at = now()
        where source_platform = t.source_platform;

    elsif is_stale and t.alerting
          and (t.last_alerted_at is null or now() - t.last_alerted_at > interval '6 hours') then
      perform public._sync_alert(
        webhook,
        format('🚨 **Still down: %s** — stale since %s UTC.',
               t.label, coalesce(to_char(last_ok at time zone 'UTC', 'Mon DD HH24:MI'), 'never')));
      update public.sync_monitor_targets
        set last_alerted_at = now()
        where source_platform = t.source_platform;

    elsif not is_stale and t.alerting then
      perform public._sync_alert(
        webhook,
        format('✅ **Recovered: %s** — fresh again (last success %s UTC).',
               t.label, to_char(last_ok at time zone 'UTC', 'Mon DD HH24:MI')));
      update public.sync_monitor_targets
        set alerting = false, last_alerted_at = now()
        where source_platform = t.source_platform;
    end if;
  end loop;
end;
$$;

-- Definer functions stay out of reach of untrusted roles; cron runs as the
-- owner (postgres), service_role may invoke check_sync_health for verification.
revoke all on function public._sync_alert(text, text) from public;
revoke all on function public.check_sync_health() from public;
grant execute on function public.check_sync_health() to service_role;

-- Run every 30 min. cron.schedule upserts by name, so re-applying is idempotent.
select cron.schedule('sync-health-check', '*/30 * * * *', $$ select public.check_sync_health(); $$);
