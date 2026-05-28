-- Document the subscriber-link columns (added in 020) so future contributors
-- understand what they're for. These exist to support the upcoming explicit
-- "claim your player profile" flow — they are NOT auto-populated from the
-- subscribe form (that approach was tried and pulled out; see
-- apps/web/src/lib/player-linker.ts for the full context).

comment on column email_subscribers.name is
  'Display name collected at signup. NOT used for auto-linking — see player-linker.ts.';

comment on column email_subscribers.player_id is
  'Linked player_id, set only after the subscriber explicitly claims a player profile via /profile/find + email confirmation. Personalization features (smart alerts, "who else is going", watchlists) read this.';

comment on column email_subscribers.link_status is
  'Lifecycle of the player claim: unattempted | linked | ambiguous | no_match.';

comment on column email_subscribers.linked_at is
  'Timestamp the player_id was set. NULL until claimed.';

comment on column email_subscribers.wants_smart_alerts is
  'Opt-out flag for personalized tournament alert emails. Defaults true.';

comment on table tournament_alerts_sent is
  'One row per (subscriber, tournament) — prevents re-alerting the same person on the same tournament. Used by the smart-alerts job.';
