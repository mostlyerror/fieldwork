import { supabase } from "./supabase.js";

export async function snapshotEnrichedDupr(): Promise<number> {
  const now = new Date().toISOString();

  // Find event_players that haven't been snapshotted yet but have an enriched
  // player. Include event_id so we can snapshot the format-appropriate rating.
  const { data: rows, error } = await supabase
    .from("event_players")
    .select("id, event_id, player_id, partner_id")
    .is("enriched_at", null)
    .not("player_id", "is", null);

  if (error || !rows || rows.length === 0) return 0;

  // Singles brackets must snapshot the singles rating, not doubles.
  const eventIds = Array.from(new Set(rows.map((r) => r.event_id as string).filter(Boolean)));
  const { data: events } = await supabase
    .from("tournament_events")
    .select("id, event_type")
    .in("id", eventIds);
  const isSinglesById = new Map<string, boolean>(
    (events ?? []).map((e) => [e.id as string, (e.event_type as string | null) === "singles"]),
  );

  const playerIds = new Set<string>();
  for (const row of rows) {
    if (row.player_id) playerIds.add(row.player_id as string);
    if (row.partner_id) playerIds.add(row.partner_id as string);
  }

  const { data: players } = await supabase
    .from("players")
    .select("id, dupr_doubles, dupr_verified, dupr_singles, dupr_singles_verified")
    .in("id", Array.from(playerIds));

  if (!players || players.length === 0) return 0;

  const playerMap = new Map(players.map((p) => [p.id as string, p]));

  // Pick the rating for this event's format; null when we don't have it.
  function ratingFor(player: NonNullable<typeof players>[number] | null | undefined, singles: boolean) {
    if (!player) return { rating: null as number | null, verified: null as boolean | null };
    return singles
      ? { rating: player.dupr_singles as number | null, verified: player.dupr_singles_verified as boolean | null }
      : { rating: player.dupr_doubles as number | null, verified: player.dupr_verified as boolean | null };
  }

  let updated = 0;
  for (const row of rows) {
    const singles = isSinglesById.get(row.event_id as string) ?? false;
    const player = row.player_id ? playerMap.get(row.player_id as string) : null;
    const partner = row.partner_id ? playerMap.get(row.partner_id as string) : null;

    const pr = ratingFor(player, singles);
    const ptr = ratingFor(partner, singles);
    // Nothing to snapshot for either side → leave it for a later run (the
    // player may not have a rating in this format yet).
    if (pr.rating == null && ptr.rating == null) continue;

    const patch: Record<string, unknown> = { enriched_at: now };
    if (pr.rating != null) {
      patch.enriched_dupr = pr.rating;
      patch.enriched_dupr_verified = pr.verified;
    }
    if (ptr.rating != null) {
      patch.partner_enriched_dupr = ptr.rating;
      patch.partner_enriched_dupr_verified = ptr.verified;
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
