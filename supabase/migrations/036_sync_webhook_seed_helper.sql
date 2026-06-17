-- Set/rotate the dead-man's-switch Discord webhook in Vault without committing
-- the secret to the (public) repo. service_role-only — that key is already
-- god-mode, so this adds no attack surface; it also documents the rotation path.
create or replace function public.set_sync_discord_webhook(p_url text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare existing uuid;
begin
  select id into existing from vault.secrets where name = 'discord_webhook_url' limit 1;
  if existing is null then
    perform vault.create_secret(p_url, 'discord_webhook_url', 'Discord webhook for sync dead-mans-switch');
  else
    perform vault.update_secret(existing, p_url);
  end if;
end;
$$;

revoke all on function public.set_sync_discord_webhook(text) from public;
grant execute on function public.set_sync_discord_webhook(text) to service_role;
