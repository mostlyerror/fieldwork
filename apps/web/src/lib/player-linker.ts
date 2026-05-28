/**
 * Subscriber ↔ Player linking utility.
 *
 * NOT WIRED INTO PRODUCTION FLOWS YET.
 *
 * This utility (and the player_id / link_status / linked_at / wants_smart_alerts
 * columns on email_subscribers, added in migration 020) exists to support the
 * "claim your player profile" flow that personalization features will sit on top of
 * (smart tournament alerts, "who else is going", watchlists, rivalry tracker,
 * post-tournament recap emails).
 *
 * We initially used these helpers to auto-link subscribers at signup based on a
 * fuzzy name match, but pulled that out — heuristic identity is too fragile
 * (single first names match the wrong person; new tournaments add ambiguity to
 * past matches; users never see the silent guess so they can't correct it).
 *
 * The intended path forward:
 *
 *   1. Subscribe form stays light (email + optional display name).
 *   2. Welcome email contains a "Claim your player profile" CTA.
 *   3. /profile/find — search + candidate list, user picks the right player.
 *   4. We email a confirmation link to the subscriber's email.
 *   5. Click confirms → link recorded with audit trail (claimed_via: 'email_confirm').
 *
 * Until then, nameMatches() can still be used for the candidate-search step on
 * /profile/find, and linkSubscriberToPlayer() can be called from the confirmation
 * endpoint once the user has explicitly picked and confirmed.
 */

import { getSupabaseAdmin } from "./supabase-admin";

export type LinkResult = "linked" | "ambiguous" | "no_match";

export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function tokens(name: string): string[] {
  return normalizeName(name)
    .split(" ")
    .map((t) => t.replace(/[.,]/g, ""))
    .filter(Boolean);
}

/**
 * Does an input name match a candidate player name?
 * Rules:
 *   - First tokens must match exactly (full first name)
 *   - 1-token input → first-name-only match is acceptable
 *   - Additional input tokens must each match some later candidate token
 *   - Last-name initial is OK if input ends with a single letter
 */
export function nameMatches(input: string, candidate: string): boolean {
  const it = tokens(input);
  const pt = tokens(candidate);
  if (it.length === 0 || pt.length === 0) return false;
  if (it[0] !== pt[0]) return false;
  if (it.length === 1) return true;

  for (let i = 1; i < it.length; i++) {
    const tok = it[i];
    const candidatesRest = pt.slice(1);
    const matched = candidatesRest.some((pTok) => {
      if (tok.length === 1) return pTok.startsWith(tok); // initial
      return pTok === tok || pTok.startsWith(tok); // full or prefix
    });
    if (!matched) return false;
  }
  return true;
}

export async function linkSubscriberToPlayer(
  subscriberId: string,
  rawName: string | null | undefined,
): Promise<LinkResult> {
  const supabase = getSupabaseAdmin();

  if (!rawName || !rawName.trim()) {
    await supabase
      .from("email_subscribers")
      .update({ link_status: "no_match" })
      .eq("id", subscriberId);
    return "no_match";
  }

  const { data: candidates } = await supabase
    .from("players")
    .select("id, name");

  if (!candidates) {
    await supabase
      .from("email_subscribers")
      .update({ link_status: "no_match" })
      .eq("id", subscriberId);
    return "no_match";
  }

  const matches = candidates.filter((p) => nameMatches(rawName, p.name as string));

  if (matches.length === 1) {
    await supabase
      .from("email_subscribers")
      .update({
        player_id: matches[0].id,
        linked_at: new Date().toISOString(),
        link_status: "linked",
      })
      .eq("id", subscriberId);
    return "linked";
  }

  const status: LinkResult = matches.length === 0 ? "no_match" : "ambiguous";
  await supabase
    .from("email_subscribers")
    .update({ link_status: status })
    .eq("id", subscriberId);
  return status;
}
