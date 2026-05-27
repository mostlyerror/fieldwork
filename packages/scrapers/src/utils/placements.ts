/**
 * Split an HTML medal-winner string on <br> variants into an array of names.
 * Returns an empty array for empty/blank input.
 */
export function parseMedalNames(html: string): string[] {
  const trimmed = html.trim();
  if (!trimmed) return [];
  return trimmed.split(/<br\s*\/?>/).map((n) => n.trim());
}

/* ------------------------------------------------------------------ */
/*  PBB tournament events API types                                   */
/* ------------------------------------------------------------------ */

interface PbbEventStatus {
  id: number;
}

interface PbbEvent {
  activityId: number;
  status: PbbEventStatus;
  goldMedalTeam: string | null;
  silverMedalTeam: string | null;
  bronzeMedalTeam: string | null;
  title: string;
}

interface PbbEventGroup {
  groupTitle: string;
  events: PbbEvent[];
}

interface PbbTourneyEventsResponse {
  events: PbbEventGroup[];
}

/* ------------------------------------------------------------------ */
/*  Main placement writer                                             */
/* ------------------------------------------------------------------ */

/**
 * For every completed PBB tournament that has no placements yet,
 * fetch the medal data from the PBB API and write placement values
 * (1 = gold, 2 = silver, 3 = bronze) into `event_players`.
 *
 * Returns the total number of event_player rows updated.
 */
export async function writePlacements(): Promise<number> {
  const { supabase } = await import("./supabase.js");
  const today = new Date().toISOString().split("T")[0];

  // 1. Tournaments that have ended and are still active
  const { data: tournaments, error: tErr } = await supabase
    .from("tournaments")
    .select("id, source_url")
    .eq("status", "active")
    .lte("date_end", today);

  if (tErr) throw tErr;
  if (!tournaments || tournaments.length === 0) return 0;

  let totalPlaced = 0;

  for (const tournament of tournaments) {
    // 2. Skip if this tournament already has any placements recorded
    const { count } = await supabase
      .from("event_players")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournament.id)
      .not("placement", "is", null);

    if ((count ?? 0) > 0) continue;

    // 3. Extract slug from source_url
    const sourceUrl = tournament.source_url as string;
    const slugMatch = sourceUrl.match(
      /pickleballtournaments\.com\/tournamentDetails\.pl\?tid=([^&]+)/
    );
    if (!slugMatch) continue;
    const slug = slugMatch[1];

    // 4. Fetch PBB events API
    let pbbData: PbbTourneyEventsResponse;
    try {
      const res = await fetch(
        `https://pickleballtournaments.com/tournaments/api/tourneyEvents?slug=${slug}`
      );
      if (!res.ok) {
        console.warn(`[placements] PBB API ${res.status} for slug=${slug}`);
        continue;
      }
      pbbData = (await res.json()) as PbbTourneyEventsResponse;
    } catch (err) {
      console.warn(`[placements] PBB API fetch failed for slug=${slug}:`, err);
      continue;
    }

    // 5. Flatten completed events with medal data
    const completedEvents = pbbData.events.flatMap((group) =>
      group.events.filter((e) => e.status.id === 3 && e.goldMedalTeam)
    );

    if (completedEvents.length === 0) continue;

    // 6. Get our event mappings for this tournament
    const { data: ourEvents } = await supabase
      .from("tournament_events")
      .select("id, source_event_id")
      .eq("tournament_id", tournament.id);

    if (!ourEvents || ourEvents.length === 0) continue;

    const eventIdMap = new Map<string, string>();
    for (const e of ourEvents) {
      if (e.source_event_id) {
        eventIdMap.set(String(e.source_event_id), e.id as string);
      }
    }

    // 7. Process each completed event
    for (const pbbEvent of completedEvents) {
      const eventId = eventIdMap.get(String(pbbEvent.activityId));
      if (!eventId) continue;

      // Get event_players for this event
      const { data: eventPlayers } = await supabase
        .from("event_players")
        .select("id, player_id, players(full_name)")
        .eq("event_id", eventId);

      if (!eventPlayers || eventPlayers.length === 0) continue;

      // Build medal → placement mapping
      const medals: { names: string[]; placement: number }[] = [];
      if (pbbEvent.goldMedalTeam) {
        medals.push({ names: parseMedalNames(pbbEvent.goldMedalTeam), placement: 1 });
      }
      if (pbbEvent.silverMedalTeam) {
        medals.push({ names: parseMedalNames(pbbEvent.silverMedalTeam), placement: 2 });
      }
      if (pbbEvent.bronzeMedalTeam) {
        medals.push({ names: parseMedalNames(pbbEvent.bronzeMedalTeam), placement: 3 });
      }

      // Match medal names to event_players
      for (const medal of medals) {
        const medalNamesLower = medal.names.map((n) => n.toLowerCase());

        for (const ep of eventPlayers) {
          const playerName = (
            (ep.players as unknown as { full_name: string })?.full_name ?? ""
          ).toLowerCase();

          if (!playerName) continue;

          // For doubles: check if the player name matches any medal name
          // For singles: direct match
          const matched = medalNamesLower.some(
            (medalName) => medalName === playerName
          );

          if (matched) {
            const { error: updateErr } = await supabase
              .from("event_players")
              .update({ placement: medal.placement })
              .eq("id", ep.id);

            if (!updateErr) totalPlaced++;
          }
        }
      }
    }
  }

  return totalPlaced;
}
