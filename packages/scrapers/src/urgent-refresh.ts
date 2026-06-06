/**
 * Urgent Refresh
 *
 * Lightweight re-scrape for tournaments where registration is moving fast:
 *   - registration_close_date within 72h
 *   - date_start within 7 days
 *
 * Hits PBB JSON APIs directly (no Playwright). Updates event counts +
 * aggregate metrics and surgically merges event_players, preserving rows
 * that have placement or enriched DUPR data so we don't lose post-tournament
 * results or live-rating snapshots.
 *
 * Full crawl (2x daily) still runs the Playwright-based scraper for
 * discovery, detail-page parsing, and brand-new tournaments.
 */

import { supabase } from "./utils/supabase.js";
import { sendDiscordAlert } from "./utils/discord.js";
import {
  computeAvgDupr,
  computeFieldStrength,
  computeSandbaggerPct,
} from "./utils/intelligence.js";
import type { ScrapedPlayer } from "./types.js";
import { parsePbbEventDate } from "./utils/event-time.js";
import { getDuprCoverage, formatCoverage } from "./utils/dupr-coverage.js";

const PBB_API = "https://pickleballtournaments.com/tournaments/api";

interface PbbEvent {
  activityId: string;
  title: string;
  status: { id: number; text: string };
  showDraws: boolean;
  goldMedalTeam: string;
  silverMedalTeam: string;
  bronzeMedalTeam: string;
  numOfRegistered?: number;
  /** Per-bracket start, e.g. "Jun 7 2026 8:30 AM" (venue-local). */
  date?: string;
}

interface PbbEventPlayer {
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
  partnerSlug?: string;
}

interface DbTournament {
  id: string;
  source_url: string;
  source_platform: string;
}

interface DbEvent {
  id: string;
  source_event_id: string | null;
  skill_level_min: number | null;
  skill_level_max: number | null;
}

interface DbEventPlayer {
  id: string;
  player_name: string;
  partner_name: string | null;
  placement: number | null;
  enriched_dupr: number | null;
  partner_enriched_dupr: number | null;
}

export interface UrgentRefreshResult {
  tournamentsChecked: number;
  eventsUpdated: number;
  playersAdded: number;
  playersRemoved: number;
  errors: number;
}

function nkey(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => !!p)
    .map((p) =>
      p
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " "),
    )
    .join("|");
}

function extractSlug(sourceUrl: string): string | null {
  const m = sourceUrl.match(/\/tournaments\/([^/?#]+)/);
  return m ? m[1] : null;
}

async function fetchUrgentTournaments(): Promise<DbTournament[]> {
  const now = new Date();
  const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Closing soon
  const { data: closing } = await supabase
    .from("tournaments")
    .select("id, source_url, source_platform")
    .eq("status", "active")
    .eq("source_platform", "pickleballbrackets")
    .gte("registration_close_date", now.toISOString())
    .lte("registration_close_date", in72h);

  // Starting soon — regardless of registration status. A tournament whose
  // registration has already closed but hasn't been played yet still gets
  // roster changes (late adds, waitlist, withdrawals) and rating drift, so we
  // must keep refreshing it through the event. Previously these fell into a
  // dead zone between reg-close and start and went stale.
  const today = now.toISOString().split("T")[0];
  const { data: starting } = await supabase
    .from("tournaments")
    .select("id, source_url, source_platform")
    .eq("status", "active")
    .eq("source_platform", "pickleballbrackets")
    .gte("date_start", today)
    .lte("date_start", in7d);

  const merged = new Map<string, DbTournament>();
  for (const t of [...(closing ?? []), ...(starting ?? [])]) {
    merged.set(t.id as string, t as DbTournament);
  }
  return Array.from(merged.values());
}

async function fetchPbbEvents(slug: string): Promise<PbbEvent[]> {
  const res = await fetch(`${PBB_API}/tourneyEvents?slug=${slug}`);
  if (!res.ok) return [];
  const body = await res.json();
  const out: PbbEvent[] = [];
  for (const group of body.events ?? []) {
    for (const event of group.events ?? []) out.push(event);
  }
  return out;
}

async function fetchPbbRoster(activityId: string): Promise<PbbEventPlayer[]> {
  const res = await fetch(
    `${PBB_API}/eventPlayers?activityId=${activityId}&activitySplitId=null`,
  );
  if (!res.ok) return [];
  const body = await res.json();
  return Array.isArray(body) ? body : [];
}

function toScrapedPlayer(p: PbbEventPlayer): ScrapedPlayer | null {
  if (!p.playerFullName || !p.isRegistered) return null;
  const ps = parseFloat(p.playerSkill ?? "");
  const psv = !isNaN(ps) && ps > 0 ? ps : undefined;
  const pps = parseFloat(p.partnerSkill ?? "");
  const ppsv = !isNaN(pps) && pps > 0 ? pps : undefined;
  return {
    name: p.playerFullName.trim(),
    duprRating: psv,
    partnerName: p.partnerFullName?.trim() || undefined,
    partnerDuprRating: ppsv,
    sourcePlayerId: p.playerId || undefined,
    sourceSlug: p.playerSlug || undefined,
    location: p.playerCityState || undefined,
    gender: p.playerGender || undefined,
    partnerSourcePlayerId: p.partnerId || undefined,
  };
}

async function refreshEvent(
  tournamentId: string,
  dbEvent: DbEvent,
  pbbEvent: PbbEvent,
  result: UrgentRefreshResult,
): Promise<void> {
  const roster = await fetchPbbRoster(pbbEvent.activityId);
  const fresh = roster.map(toScrapedPlayer).filter((p): p is ScrapedPlayer => p !== null);

  // Compute new aggregates from fresh active roster
  const avgDupr = computeAvgDupr(fresh);
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
        computeSandbaggerPct(fresh, dbEvent.skill_level_min, dbEvent.skill_level_max) * 100,
      ) / 100;
  }

  const registeredCount = pbbEvent.numOfRegistered ?? fresh.length;
  const startTime = parsePbbEventDate(pbbEvent.date);

  // Update event row
  await supabase
    .from("tournament_events")
    .update({
      registered_count: registeredCount,
      avg_dupr: avgDupr,
      field_strength: fieldStrength,
      sandbagger_pct: sandbaggerPct,
      start_time: startTime.iso,
      start_time_raw: startTime.raw,
    })
    .eq("id", dbEvent.id);

  // Surgical merge of event_players
  const { data: existingRows } = await supabase
    .from("event_players")
    .select("id, player_name, partner_name, placement, enriched_dupr, partner_enriched_dupr")
    .eq("event_id", dbEvent.id);

  const existing: DbEventPlayer[] = (existingRows as DbEventPlayer[]) ?? [];
  const protectedRows = existing.filter(
    (r) => r.placement != null || r.enriched_dupr != null || r.partner_enriched_dupr != null,
  );
  const protectedKeys = new Set(
    protectedRows.map((r) => nkey(r.player_name, r.partner_name)),
  );
  const existingByKey = new Map(existing.map((r) => [nkey(r.player_name, r.partner_name), r]));
  const freshKeys = new Set(fresh.map((p) => nkey(p.name, p.partnerName)));

  // DELETE: existing non-protected rows that aren't in fresh roster
  const toDelete = existing.filter((r) => {
    const k = nkey(r.player_name, r.partner_name);
    if (protectedKeys.has(k)) return false;
    return !freshKeys.has(k);
  });
  if (toDelete.length > 0) {
    await supabase
      .from("event_players")
      .delete()
      .in(
        "id",
        toDelete.map((r) => r.id),
      );
    result.playersRemoved += toDelete.length;
  }

  // INSERT: fresh players not already represented
  const toInsert = fresh.filter((p) => !existingByKey.has(nkey(p.name, p.partnerName)));
  if (toInsert.length > 0) {
    // Resolve player_id / partner_id via the persistent players table
    const playerIds = await resolvePlayerIds(toInsert);
    const rows = toInsert.map((p) => ({
      event_id: dbEvent.id,
      player_name: p.name,
      dupr_rating: p.duprRating ?? null,
      partner_name: p.partnerName ?? null,
      partner_dupr_rating: p.partnerDuprRating ?? null,
      team_avg_dupr:
        p.duprRating != null && p.partnerDuprRating != null
          ? Math.round(((p.duprRating + p.partnerDuprRating) / 2) * 100) / 100
          : null,
      player_id: p.sourcePlayerId ? (playerIds.get(p.sourcePlayerId) ?? null) : null,
      partner_id: p.partnerSourcePlayerId
        ? (playerIds.get(p.partnerSourcePlayerId) ?? null)
        : null,
    }));

    const { error } = await supabase.from("event_players").insert(rows);
    if (error) {
      console.error(`[urgent-refresh] Insert players failed for event ${dbEvent.id}:`, error);
      result.errors++;
    } else {
      result.playersAdded += rows.length;
    }
  }

  result.eventsUpdated++;
}

async function resolvePlayerIds(
  players: ScrapedPlayer[],
): Promise<Map<string, string>> {
  const sourceIds = new Set<string>();
  for (const p of players) {
    if (p.sourcePlayerId) sourceIds.add(p.sourcePlayerId);
    if (p.partnerSourcePlayerId) sourceIds.add(p.partnerSourcePlayerId);
  }
  if (sourceIds.size === 0) return new Map();
  const { data } = await supabase
    .from("players")
    .select("id, source_player_id")
    .in("source_player_id", Array.from(sourceIds));
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.source_player_id as string, row.id as string);
  }
  return map;
}

export async function runUrgentRefresh(): Promise<UrgentRefreshResult> {
  const result: UrgentRefreshResult = {
    tournamentsChecked: 0,
    eventsUpdated: 0,
    playersAdded: 0,
    playersRemoved: 0,
    errors: 0,
  };

  const tournaments = await fetchUrgentTournaments();
  console.log(`[urgent-refresh] ${tournaments.length} tournaments need refresh`);
  if (tournaments.length === 0) return result;

  for (const tournament of tournaments) {
    result.tournamentsChecked++;
    const slug = extractSlug(tournament.source_url);
    if (!slug) continue;

    try {
      const pbbEvents = await fetchPbbEvents(slug);
      const pbbByActivityId = new Map<string, PbbEvent>(
        pbbEvents.map((e) => [e.activityId.toLowerCase(), e]),
      );

      const { data: dbEvents } = await supabase
        .from("tournament_events")
        .select("id, source_event_id, skill_level_min, skill_level_max")
        .eq("tournament_id", tournament.id);

      for (const dbEvent of (dbEvents ?? []) as DbEvent[]) {
        if (!dbEvent.source_event_id) continue;
        const pbb = pbbByActivityId.get(dbEvent.source_event_id.toLowerCase());
        if (!pbb) continue;
        try {
          await refreshEvent(tournament.id, dbEvent, pbb, result);
        } catch (err) {
          console.error(`[urgent-refresh] Event ${dbEvent.id} failed:`, err);
          result.errors++;
        }
      }
    } catch (err) {
      console.error(`[urgent-refresh] Tournament ${slug} failed:`, err);
      result.errors++;
    }
  }

  if (result.eventsUpdated > 0 || result.errors > 0) {
    const coverage = await getDuprCoverage().catch(() => null);
    const coverageLine = coverage ? `\n📊 DUPR coverage: ${formatCoverage(coverage)}` : "";
    await sendDiscordAlert({
      title: "♻️ Urgent refresh",
      description: `${result.eventsUpdated} events updated · +${result.playersAdded} −${result.playersRemoved} players · ${result.errors} errors${coverageLine}`,
    });
  }

  return result;
}
