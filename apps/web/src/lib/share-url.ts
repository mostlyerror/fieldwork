/**
 * Stamp UTM attribution params onto a URL at share time.
 *
 * PostHog auto-captures utm_* params off the landing URL and promotes them to
 * initial-touch person properties, so attribution "just works" on arrival — as
 * long as the links we hand out actually carry the params. This is the only
 * piece that needs writing: every share surface routes its outbound URL through
 * here so we can slice return visits by method / content type / specific entity.
 *
 * Taxonomy:
 *   utm_source   = "share"        (constant — distinguishes user shares from organic/direct)
 *   utm_medium   = how it was shared (copy_link, copy_text, native_share, result_card_link)
 *   utm_campaign = what was shared (tournament, result_card)
 *   utm_content  = the specific entity id (which tournament/result went viral)
 */

const UTM_SOURCE = "share";

export type ShareMedium =
  | "copy_link"
  | "copy_text"
  | "native_share"
  | "result_card_link";

export type ShareCampaign = "tournament" | "result_card";

export interface ShareUrlOptions {
  medium: ShareMedium;
  campaign: ShareCampaign;
  /** Specific entity id (tournamentId, or `${eventId}:${playerId}` for results). */
  content?: string;
}

export function buildShareUrl(rawUrl: string, opts: ShareUrlOptions): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    // Not an absolute URL we can safely manipulate — hand it back untouched
    // rather than producing a broken link.
    return rawUrl;
  }

  const params = url.searchParams;

  // Strip any inbound attribution so a link reached via one share doesn't
  // propagate stale UTMs when the recipient re-shares it.
  for (const key of [...params.keys()]) {
    if (key.startsWith("utm_")) params.delete(key);
  }

  params.set("utm_source", UTM_SOURCE);
  params.set("utm_medium", opts.medium);
  params.set("utm_campaign", opts.campaign);
  if (opts.content) params.set("utm_content", opts.content);

  return url.toString();
}
