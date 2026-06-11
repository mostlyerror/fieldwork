import { sendResultDrops, type ResultDrop } from "./result-drops.js";

const PBB_API = "https://pickleballtournaments.com/tournaments/api";

export function parseMedalNames(html: string): string[] {
  const trimmed = html.trim();
  if (!trimmed) return [];
  return trimmed.split(/<br\s*\/?>/i).map((n) => n.trim()).filter(Boolean);
}

// Generational suffixes the medal API includes but the roster omits
// ("Edward Muniz Jr" vs "Edward Muniz"). Only stripped from names with 3+
// tokens so a genuine two-token "<First> V" roster initial is left alone.
const NAME_SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);

function normalizeName(s: string): string {
  const n = s.trim().toLowerCase().replace(/\s+/g, " ");
  const parts = n.split(" ");
  if (parts.length >= 3 && NAME_SUFFIXES.has(parts[parts.length - 1])) {
    parts.pop();
    return parts.join(" ");
  }
  return n;
}

export function nameMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;

  // PBB's public roster often truncates the surname to an initial ("Hue W")
  // while the medal API returns the full name ("Hue Wong"). Treat these as a
  // match only when the first names are identical AND one surname is the
  // other's leading initial — tight enough to avoid false pairings.
  const pa = na.split(" ");
  const pb = nb.split(" ");
  if (pa.length < 2 || pb.length < 2) return false;
  if (pa[0] !== pb[0]) return false;
  const lastA = pa[pa.length - 1];
  const lastB = pb[pb.length - 1];
  if (lastA.length === 1 && lastB.startsWith(lastA)) return true;
  if (lastB.length === 1 && lastA.startsWith(lastB)) return true;
  return false;
}

interface PbbEvent {
  activityId: string;
  title: string;
  status: { id: number };
  goldMedalTeam: string;
  silverMedalTeam: string;
  bronzeMedalTeam: string;
}

export interface PbbRosterEntry {
  playerFullName: string;
  partnerFullName?: string | null;
  playerSkill?: string;
  partnerSkill?: string;
  isRegistered: boolean;
  playerId?: string;
  playerSlug?: string;
  playerCityState?: string;
  playerGender?: string;
  partnerId?: string;
}

/**
 * Find a medal team in PBB's live roster. Used when a medalist is missing
 * from OUR roster: teams that join an event after our last pre-start sync
 * (late adds, bracket merges on tournament day) never reach event_players —
 * rosters freeze once play starts — so their medals had nowhere to land.
 */
export function findMedalTeamInRoster(
  roster: PbbRosterEntry[],
  medalNames: string[],
): PbbRosterEntry | null {
  for (const entry of roster) {
    if (!entry.isRegistered || !entry.playerFullName) continue;
    if (medalNames.length === 1) {
      if (nameMatch(entry.playerFullName, medalNames[0])) return entry;
      continue;
    }
    const names = [entry.playerFullName, entry.partnerFullName].filter(Boolean) as string[];
    if (
      names.length >= medalNames.length &&
      medalNames.every((mn) => names.some((pn) => nameMatch(mn, pn)))
    ) {
      return entry;
    }
  }
  return null;
}

// Keep re-checking a tournament for this many days after it ends. Medals post
// piecemeal on PBB — bronze lags gold/silver, and different events finish at
// different times — so a one-and-done pass misses late results.
const RECHECK_WINDOW_DAYS = 21;

export async function writePlacements(): Promise<number> {
  const { supabase } = await import("./supabase.js");
  const today = new Date().toISOString().split("T")[0];
  const cutoff = new Date(Date.now() - RECHECK_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .split("T")[0];

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, source_url")
    .eq("status", "active")
    .lte("date_end", today)
    .gte("date_end", cutoff);

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

    // NOTE: we intentionally do NOT skip tournaments that already have some
    // placements. The per-medal guard below (only act when a player has no
    // placement yet) makes re-runs idempotent, so late-posted medals — bronze,
    // or a whole event that finished after the first pass — get backfilled
    // without re-writing or re-announcing existing medalists.
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
        .select("id, player_id, player_name, partner_name, placement")
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
          // Idempotency: a player who already has a placement was written on a
          // prior run — don't overwrite it or re-emit a Result Drop for them.
          if (matched.placement != null) continue;
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
          // Medalist missing from our roster — backfill from PBB's live
          // eventPlayers API (still served after completion) so the medal
          // has a row to land on, then write the placement in one insert.
          const backfilled = await backfillMissingMedalist(
            eventId,
            pbbEvent.activityId,
            medal.names,
            medal.placement,
          );
          if (backfilled) {
            totalWritten++;
            console.log(
              `[placements] ${medal.names.join(" / ")} → ${medal.placement === 1 ? "🥇" : medal.placement === 2 ? "🥈" : "🥉"} in ${pbbEvent.title} (roster backfilled)`,
            );
            if (backfilled.playerId) {
              drops.push({
                tournamentName: (tournament.name as string) ?? "Tournament",
                eventName: pbbEvent.title,
                eventId,
                playerId: backfilled.playerId,
                playerName: backfilled.playerName,
                partnerName: backfilled.partnerName,
                placement: medal.placement,
              });
            }
          } else {
            console.log(
              `[placements] WARN: no match for ${medal.names.join(" / ")} in ${pbbEvent.title}`,
            );
          }
        }
      }
    }
  }

  console.log(`[placements] Wrote ${totalWritten} placements`);
  // Push ready-to-post social prompts for the new gold medalists (the loop).
  await sendResultDrops(drops);
  return totalWritten;
}

/** Insert a medal team that never made it into event_players (late add or
 *  bracket merge after our last roster sync), placement included. Returns
 *  the inserted identity, or null when PBB's roster doesn't have them either. */
async function backfillMissingMedalist(
  eventId: string,
  activityId: string,
  medalNames: string[],
  placement: number,
): Promise<{ playerId: string | null; playerName: string; partnerName: string | null } | null> {
  const res = await fetch(
    `${PBB_API}/eventPlayers?activityId=${activityId}&activitySplitId=null`,
  );
  if (!res.ok) return null;
  const roster = (await res.json()) as PbbRosterEntry[];
  if (!Array.isArray(roster)) return null;

  const entry = findMedalTeamInRoster(roster, medalNames);
  if (!entry) return null;

  const { supabase } = await import("./supabase.js");
  const { upsertPlayers } = await import("./upsert.js");

  const skill = parseFloat(entry.playerSkill ?? "");
  const partnerSkill = parseFloat(entry.partnerSkill ?? "");
  const scraped = {
    name: entry.playerFullName.trim(),
    duprRating: !isNaN(skill) && skill > 0 ? skill : undefined,
    partnerName: entry.partnerFullName?.trim() || undefined,
    partnerDuprRating: !isNaN(partnerSkill) && partnerSkill > 0 ? partnerSkill : undefined,
    sourcePlayerId: entry.playerId || undefined,
    sourceSlug: entry.playerSlug || undefined,
    location: entry.playerCityState || undefined,
    gender: entry.playerGender || undefined,
    partnerSourcePlayerId: entry.partnerId || undefined,
  };
  const idMap = await upsertPlayers([scraped]);
  const playerId = scraped.sourcePlayerId ? (idMap.get(scraped.sourcePlayerId) ?? null) : null;

  const { error } = await supabase.from("event_players").insert({
    event_id: eventId,
    player_name: scraped.name,
    dupr_rating: scraped.duprRating ?? null,
    partner_name: scraped.partnerName ?? null,
    partner_dupr_rating: scraped.partnerDuprRating ?? null,
    team_avg_dupr:
      scraped.duprRating != null && scraped.partnerDuprRating != null
        ? Math.round(((scraped.duprRating + scraped.partnerDuprRating) / 2) * 100) / 100
        : null,
    player_id: playerId,
    partner_id: scraped.partnerSourcePlayerId
      ? (idMap.get(scraped.partnerSourcePlayerId) ?? null)
      : null,
    placement,
  });
  if (error) {
    console.error(`[placements] backfill insert failed for ${scraped.name}:`, error.message);
    return null;
  }
  return { playerId, playerName: scraped.name, partnerName: scraped.partnerName ?? null };
}
