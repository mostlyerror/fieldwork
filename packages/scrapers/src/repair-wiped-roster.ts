/**
 * Repair tournaments whose rosters were wiped by a post-start full scrape.
 *
 * Incident (2026-06-10): once a tournament starts, PBB's events page drops the
 * Registered/All buttons, so the Playwright scrape read every event as zero
 * players; upsertEvents then delete+reinserted the events, destroying the
 * roster AND nulling source_event_id (severing urgent-refresh, placements,
 * and the live bracket). Both are now guarded (roster-guard.ts + the
 * started-tournament skip in pickleballbrackets.ts); this script restores the
 * already-damaged rows from PBB's JSON APIs, which still serve full rosters
 * after completion.
 *
 * Usage: npx tsx src/repair-wiped-roster.ts <tournament-id> [<tournament-id> ...]
 */

import { supabase } from "./utils/supabase.js";
import { upsertPlayers } from "./utils/upsert.js";
import {
  computeAvgDupr,
  computeFieldStrength,
  computeSandbaggerPct,
} from "./utils/intelligence.js";
import type { ScrapedPlayer } from "./types.js";

const PBB_API = "https://pickleballtournaments.com/tournaments/api";

interface PbbEvent {
  title: string;
  activityId: string;
  numOfRegistered?: number;
}

async function repairTournament(tournamentId: string): Promise<void> {
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, source_url")
    .eq("id", tournamentId)
    .single();

  if (!tournament) {
    console.error(`[repair] Tournament ${tournamentId} not found`);
    return;
  }

  const slug = (tournament.source_url as string)
    .split("/tournaments/")[1]
    ?.replace(/\/.*$/, "");
  if (!slug) {
    console.error(`[repair] No slug for ${tournament.name}`);
    return;
  }
  console.log(`[repair] ${tournament.name} (${slug})`);

  const res = await fetch(`${PBB_API}/tourneyEvents?slug=${slug}`);
  if (!res.ok) {
    console.error(`[repair] tourneyEvents fetch failed: ${res.status}`);
    return;
  }
  const body = await res.json();
  const pbbEvents: PbbEvent[] = [];
  for (const group of body.events ?? []) {
    for (const e of group.events ?? []) pbbEvents.push(e);
  }
  const pbbByTitle = new Map(pbbEvents.map((e) => [e.title.trim().toLowerCase(), e]));

  const { data: dbEvents } = await supabase
    .from("tournament_events")
    .select("id, name, source_event_id, skill_level_min, skill_level_max, event_players(count)")
    .eq("tournament_id", tournamentId);

  for (const dbEvent of dbEvents ?? []) {
    const existingPlayers = (dbEvent.event_players as { count: number }[])[0]?.count ?? 0;
    const pbb = pbbByTitle.get((dbEvent.name as string).trim().toLowerCase());
    if (!pbb) {
      console.warn(`[repair]   no PBB match for event "${dbEvent.name}"`);
      continue;
    }

    // Re-link the event to its PBB activity (the wipe nulled this)
    await supabase
      .from("tournament_events")
      .update({
        source_event_id: pbb.activityId,
        registered_count: pbb.numOfRegistered ?? 0,
      })
      .eq("id", dbEvent.id);

    if (existingPlayers > 0) {
      await recomputeAggregates(dbEvent);
      console.log(`[repair]   "${dbEvent.name}": relinked, roster intact (${existingPlayers} players)`);
      continue;
    }

    // Rebuild the roster from the eventPlayers API
    const rosterRes = await fetch(
      `${PBB_API}/eventPlayers?activityId=${pbb.activityId}&activitySplitId=null`,
    );
    if (!rosterRes.ok) {
      console.error(`[repair]   eventPlayers fetch failed for "${dbEvent.name}"`);
      continue;
    }
    const roster = (await rosterRes.json()) as Array<{
      playerFullName: string;
      partnerFullName?: string;
      playerSkill?: string;
      partnerSkill?: string;
      isRegistered: boolean;
      playerId?: string;
      playerSlug?: string;
      playerCityState?: string;
      playerGender?: string;
      partnerId?: string;
    }>;

    const players: ScrapedPlayer[] = [];
    for (const p of roster) {
      if (!p.isRegistered || !p.playerFullName) continue;
      const skill = parseFloat(p.playerSkill ?? "");
      const partnerSkill = parseFloat(p.partnerSkill ?? "");
      players.push({
        name: p.playerFullName.trim(),
        duprRating: !isNaN(skill) && skill > 0 ? skill : undefined,
        partnerName: p.partnerFullName?.trim() || undefined,
        partnerDuprRating: !isNaN(partnerSkill) && partnerSkill > 0 ? partnerSkill : undefined,
        sourcePlayerId: p.playerId || undefined,
        sourceSlug: p.playerSlug || undefined,
        location: p.playerCityState || undefined,
        gender: p.playerGender || undefined,
        partnerSourcePlayerId: p.partnerId || undefined,
      });
    }

    const playerIdMap = await upsertPlayers(players);
    const rows = players.map((p) => ({
      event_id: dbEvent.id,
      player_name: p.name,
      dupr_rating: p.duprRating ?? null,
      partner_name: p.partnerName ?? null,
      partner_dupr_rating: p.partnerDuprRating ?? null,
      team_avg_dupr:
        p.duprRating != null && p.partnerDuprRating != null
          ? Math.round(((p.duprRating + p.partnerDuprRating) / 2) * 100) / 100
          : null,
      player_id: p.sourcePlayerId ? (playerIdMap.get(p.sourcePlayerId) ?? null) : null,
      partner_id: p.partnerSourcePlayerId
        ? (playerIdMap.get(p.partnerSourcePlayerId) ?? null)
        : null,
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from("event_players").insert(rows);
      if (error) {
        console.error(`[repair]   insert failed for "${dbEvent.name}":`, error.message);
      } else {
        await recomputeAggregates(dbEvent);
        console.log(`[repair]   "${dbEvent.name}": restored ${rows.length} players`);
      }
    } else {
      console.log(`[repair]   "${dbEvent.name}": PBB roster empty, nothing to restore`);
    }
  }
}

/** Field-intel aggregates (avg DUPR, field strength, over-cap %) from the
 *  event's current roster — the wipe zeroed these alongside the players. */
async function recomputeAggregates(dbEvent: {
  id: string;
  skill_level_min: number | null;
  skill_level_max: number | null;
}): Promise<void> {
  const { data: roster } = await supabase
    .from("event_players")
    .select("dupr_rating, partner_dupr_rating")
    .eq("event_id", dbEvent.id);

  const players: ScrapedPlayer[] = (roster ?? []).map((r) => ({
    name: "",
    duprRating: (r.dupr_rating as number | null) ?? undefined,
    partnerDuprRating: (r.partner_dupr_rating as number | null) ?? undefined,
  }));

  const avgDupr = computeAvgDupr(players);
  let fieldStrength: number | null = null;
  let sandbaggerPct: number | null = null;
  if (
    avgDupr != null &&
    dbEvent.skill_level_min != null &&
    dbEvent.skill_level_max != null &&
    dbEvent.skill_level_max > dbEvent.skill_level_min
  ) {
    fieldStrength =
      Math.round(
        computeFieldStrength(dbEvent.skill_level_min, dbEvent.skill_level_max, avgDupr) * 100,
      ) / 100;
    sandbaggerPct =
      Math.round(
        computeSandbaggerPct(players, dbEvent.skill_level_min, dbEvent.skill_level_max) * 100,
      ) / 100;
  }

  await supabase
    .from("tournament_events")
    .update({ avg_dupr: avgDupr, field_strength: fieldStrength, sandbagger_pct: sandbaggerPct })
    .eq("id", dbEvent.id);
}

async function main() {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  if (ids.length === 0) {
    console.error("Usage: npx tsx src/repair-wiped-roster.ts <tournament-id> [...]");
    process.exit(1);
  }
  for (const id of ids) {
    await repairTournament(id);
  }
}

main();
