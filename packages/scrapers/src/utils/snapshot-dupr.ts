import { supabase } from "./supabase.js";

export async function snapshotEnrichedDupr(): Promise<number> {
  const now = new Date().toISOString();

  // Find event_players that haven't been snapshotted yet but have an enriched player
  const { data: rows, error } = await supabase
    .from("event_players")
    .select("id, player_id, partner_id")
    .is("enriched_at", null)
    .not("player_id", "is", null);

  if (error || !rows || rows.length === 0) return 0;

  const playerIds = new Set<string>();
  for (const row of rows) {
    if (row.player_id) playerIds.add(row.player_id as string);
    if (row.partner_id) playerIds.add(row.partner_id as string);
  }

  const { data: players } = await supabase
    .from("players")
    .select("id, dupr_doubles, dupr_verified")
    .in("id", Array.from(playerIds))
    .not("dupr_doubles", "is", null);

  if (!players || players.length === 0) return 0;

  const playerMap = new Map(players.map((p) => [p.id as string, p]));

  let updated = 0;
  for (const row of rows) {
    const player = row.player_id ? playerMap.get(row.player_id as string) : null;
    const partner = row.partner_id ? playerMap.get(row.partner_id as string) : null;
    if (!player && !partner) continue;

    const patch: Record<string, unknown> = { enriched_at: now };
    if (player) {
      patch.enriched_dupr = player.dupr_doubles;
      patch.enriched_dupr_verified = player.dupr_verified;
    }
    if (partner) {
      patch.partner_enriched_dupr = partner.dupr_doubles;
      patch.partner_enriched_dupr_verified = partner.dupr_verified;
    }

    const { error: updateError } = await supabase
      .from("event_players")
      .update(patch)
      .eq("id", row.id);

    if (!updateError) updated++;
  }

  console.log(`[snapshot-dupr] Snapshotted ${updated} event_players`);
  return updated;
}
