import { sendResultDrops, type ResultDrop } from "./result-drops.js";

const PBB_API = "https://pickleballtournaments.com/tournaments/api";

export function parseMedalNames(html: string): string[] {
  const trimmed = html.trim();
  if (!trimmed) return [];
  return trimmed.split(/<br\s*\/?>/i).map((n) => n.trim()).filter(Boolean);
}

function nameMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

interface PbbEvent {
  activityId: string;
  title: string;
  status: { id: number };
  goldMedalTeam: string;
  silverMedalTeam: string;
  bronzeMedalTeam: string;
}

export async function writePlacements(): Promise<number> {
  const { supabase } = await import("./supabase.js");
  const today = new Date().toISOString().split("T")[0];

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, source_url")
    .eq("status", "active")
    .lte("date_end", today);

  if (!tournaments || tournaments.length === 0) return 0;

  let totalWritten = 0;
  const drops: ResultDrop[] = [];

  for (const tournament of tournaments) {
    const slug = (tournament.source_url as string)
      .split("/tournaments/")[1]
      ?.replace(/\/.*$/, "");
    if (!slug) continue;

    const { data: ourEvents } = await supabase
      .from("tournament_events")
      .select("id, source_event_id")
      .eq("tournament_id", tournament.id);

    if (!ourEvents || ourEvents.length === 0) continue;

    // Check if any event already has placements
    const eventIds = ourEvents.map((e) => e.id);
    const { data: existingPlacements } = await supabase
      .from("event_players")
      .select("id")
      .in("event_id", eventIds)
      .not("placement", "is", null)
      .limit(1);

    if (existingPlacements && existingPlacements.length > 0) continue;

    const res = await fetch(`${PBB_API}/tourneyEvents?slug=${slug}`);
    if (!res.ok) continue;

    const body = await res.json();
    const pbbEvents: PbbEvent[] = [];
    for (const group of body.events ?? []) {
      for (const event of group.events ?? []) {
        pbbEvents.push(event);
      }
    }

    const eventMap = new Map<string, string>();
    for (const e of ourEvents) {
      if (e.source_event_id) {
        eventMap.set((e.source_event_id as string).toLowerCase(), e.id as string);
      }
    }

    for (const pbbEvent of pbbEvents) {
      if (pbbEvent.status.id !== 3) continue;
      if (!pbbEvent.goldMedalTeam) continue;

      const eventId = eventMap.get(pbbEvent.activityId.toLowerCase());
      if (!eventId) continue;

      const { data: players } = await supabase
        .from("event_players")
        .select("id, player_id, player_name, partner_name")
        .eq("event_id", eventId);

      if (!players) continue;

      const medals = [
        { placement: 1, names: parseMedalNames(pbbEvent.goldMedalTeam) },
        { placement: 2, names: parseMedalNames(pbbEvent.silverMedalTeam) },
        { placement: 3, names: parseMedalNames(pbbEvent.bronzeMedalTeam) },
      ];

      for (const medal of medals) {
        if (medal.names.length === 0) continue;

        const matched = players.find((p) => {
          const playerName = p.player_name as string;
          const partnerName = p.partner_name as string | null;

          if (medal.names.length === 1) {
            return nameMatch(playerName, medal.names[0]);
          }
          const names = [playerName, partnerName].filter(Boolean) as string[];
          return (
            medal.names.every((mn) => names.some((pn) => nameMatch(mn, pn))) &&
            names.length >= medal.names.length
          );
        });

        if (matched) {
          const { error } = await supabase
            .from("event_players")
            .update({ placement: medal.placement })
            .eq("id", matched.id);

          if (!error) {
            totalWritten++;
            console.log(
              `[placements] ${medal.names.join(" / ")} → ${medal.placement === 1 ? "🥇" : medal.placement === 2 ? "🥈" : "🥉"} in ${pbbEvent.title}`,
            );
            // Collect for Result Drops (needs a global player_id for the share link).
            if (matched.player_id) {
              drops.push({
                tournamentName: (tournament.name as string) ?? "Tournament",
                eventName: pbbEvent.title,
                eventId,
                playerId: matched.player_id as string,
                playerName: matched.player_name as string,
                partnerName: (matched.partner_name as string | null) ?? null,
                placement: medal.placement,
              });
            }
          }
        } else {
          console.log(
            `[placements] WARN: no match for ${medal.names.join(" / ")} in ${pbbEvent.title}`,
          );
        }
      }
    }
  }

  console.log(`[placements] Wrote ${totalWritten} placements`);
  // Push ready-to-post social prompts for the new gold medalists (the loop).
  await sendResultDrops(drops);
  return totalWritten;
}
