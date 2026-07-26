-- Sweep of the rest of the schema after 037, same audit: for every table, what
-- can someone do holding only the public anon key (and, where it matters, a
-- signed-up user's JWT)? Findings, worst first.

-- 1. submission_rate_limits never had RLS enabled, and Supabase's default
--    `grant all` therefore applied unfiltered. Verified live against prod with
--    the anon key alone: SELECT returned real submitter IP addresses (200) and
--    INSERT succeeded (201; probe row removed). DELETE was granted too, which
--    makes the submission rate limiter self-defeating — you bypass it by
--    deleting your own row. Only server code touches this table, through the
--    service-role client, so shut the door completely.
alter table public.submission_rate_limits enable row level security;
revoke all on public.submission_rate_limits from anon, authenticated;

-- 2. `players_claim` allowed UPDATE on any row where user_id is null — which is
--    every player in the scraped roster — for any authenticated user. The
--    WITH CHECK (user_id = auth.uid()) only forced the claimer to own the row
--    afterwards; because the grant covered all columns, name, DUPR ratings and
--    everything else were rewritable on the way through. That's arbitrary
--    corruption of the core dataset by anyone who signs up.
--
--    Nothing in the app claims a player with a user JWT: the claim flow is
--    server-side via the service-role client (app/profile/claim/[token],
--    app/profile/find/actions.ts, player_claims table). The scrapers likewise
--    use the service role. So the policy is vestigial — drop it and take the
--    write grants with it. Public SELECT on players is unchanged.
drop policy if exists "players_claim" on public.players;
revoke insert, update, delete on public.players from anon, authenticated;

-- 3. Same missing-WITH-CHECK bug that 037 fixed on users, on three more tables:
--    USING alone says which rows you may update, not what they may become, so a
--    user can rewrite user_id and hand their row to (or steal it from) someone
--    else.
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notification_prefs_update_own" on public.notification_preferences;
create policy "notification_prefs_update_own" on public.notification_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "partner_posts_update_own" on public.partner_posts;
create policy "partner_posts_update_own" on public.partner_posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. result_card_picks is an anonymous analytics ping and public INSERT is the
--    intent — but `style` was unbounded free text, so a caller could write
--    megabytes per row, and UPDATE/DELETE were granted for no reason. Also drop
--    the public read: these are our internal share-style counts, not user-facing
--    content, and nothing in the app reads them with the anon key.
--    (Table is empty today, so the constraint applies cleanly.)
alter table public.result_card_picks
  add constraint result_card_picks_style_check
  check (style in ('dark', 'editorial', 'podium'));
revoke update, delete on public.result_card_picks from anon, authenticated;
drop policy if exists "Public read" on public.result_card_picks;

-- 5. Supabase's default grants also hand anon/authenticated TRUNCATE on every
--    table. TRUNCATE ignores RLS entirely, so it is only unreachable because
--    PostgREST has no way to issue one — a latent footgun rather than a live
--    hole, but there is no reason for these roles to hold it. Note this covers
--    existing tables only; new tables inherit the default grants again.
revoke truncate on all tables in schema public from anon, authenticated;
