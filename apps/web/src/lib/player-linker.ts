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

  const target = normalizeName(rawName);

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

  const matches = candidates.filter((p) => normalizeName(p.name as string) === target);

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
