-- Close a privilege-escalation hole: users.role was self-assignable.
--
-- Migration 001 created `users_update_own` as FOR UPDATE USING (auth.uid() = id)
-- with no WITH CHECK, and migration 010 later added `role` to that same table.
-- Supabase's default table grants give `authenticated` UPDATE on every column,
-- so any signed-up user could PATCH /rest/v1/users?id=eq.<self> {"role":"admin"}
-- with the public anon key and their own session JWT — verified live, HTTP 200 —
-- which unlocks /admin and, through it, the service-role key, the Instagram
-- publish token, and GITHUB_PAT workflow dispatch. Signup is public, so this was
-- reachable by anyone.
--
-- Three layers here, because any one of them can be undone by accident:
--   1. grants  — `authenticated` loses write access to public.users entirely
--   2. policy  — WITH CHECK, so a row can't be rewritten to another user's id
--   3. trigger — role changes are rejected no matter what the grants say
--
-- Nothing in the app writes to public.users with a user JWT: every write goes
-- through the service-role client (lib/supabase-admin.ts), which bypasses both
-- RLS and these grants. Reads DO use the anon key + user JWT (lib/auth.ts
-- getUserRole / getUserProfile), so SELECT stays exactly as it was.

-- 1. Least privilege. Postgres can't revoke a single column out of a table-wide
--    grant, and the app needs no client-side writes at all, so drop write access
--    outright. If client-side profile editing is ever added, grant the specific
--    safe columns back — e.g.
--      grant update (name, skill_level, gender) on public.users to authenticated;
--    never `id`, `role`, `email`, or `created_at`.
revoke insert, update, delete on public.users from anon, authenticated;

-- 2. USING picks which rows you may update; without WITH CHECK the *resulting*
--    row is unconstrained, so a user could rewrite their own row's id to point
--    at someone else's account. Constrain both sides.
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 3. Backstop. `grant all on all tables in schema public to anon, authenticated`
--    is a one-liner that ships in half the Supabase snippets on the internet and
--    would silently reopen step 1. This makes role escalation fail loudly even
--    then. current_user is the role PostgREST switched into: `anon` /
--    `authenticated` for API callers, `service_role` for our server code.
create or replace function public.guard_users_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'users.role is not self-assignable (attempted by %)', current_user
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists users_guard_role_change on public.users;
create trigger users_guard_role_change
  before update on public.users
  for each row execute function public.guard_users_role_change();
