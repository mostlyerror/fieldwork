import { supabase } from "./supabase.js";

const DUPR_API_BASE = "https://api.dupr.gg";
const BATCH_SIZE = 30;
const STALE_DAYS = 7;

// Timing ranges (ms) — randomized to mimic human browsing patterns
const DELAY_MIN = 2000;
const DELAY_MAX = 5000;
const LONG_PAUSE_CHANCE = 0.12;
const LONG_PAUSE_MIN = 8000;
const LONG_PAUSE_MAX = 18000;
const BACKOFF_MIN = 25_000;
const BACKOFF_MAX = 90_000;
const MAX_RETRIES = 2;

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

function humanDelay(): number {
  if (Math.random() < LONG_PAUSE_CHANCE) {
    return randBetween(LONG_PAUSE_MIN, LONG_PAUSE_MAX);
  }
  const a = randBetween(DELAY_MIN, DELAY_MAX);
  const b = randBetween(DELAY_MIN, DELAY_MAX);
  return Math.floor((a + b) / 2);
}

function backoffDelay(): number {
  return randBetween(BACKOFF_MIN, BACKOFF_MAX);
}

function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function apiHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": pickUserAgent(),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

interface PlayerNeedingMatches {
  id: string;
  name: string;
  dupr_id: string;
}

interface DuprSearchHit {
  id: number;
  duprId?: string;
  fullName: string;
}

interface DuprTeamPlayer {
  id: number;
  fullName: string;
  duprId?: string;
}

interface DuprTeam {
  serial: number;
  player1: DuprTeamPlayer;
  player2?: DuprTeamPlayer;
  game1?: number;
  game2?: number;
  game3?: number;
  game4?: number;
  game5?: number;
  winner: boolean;
}

interface DuprMatchHit {
  matchId: number;
  eventDate: string;
  eventFormat: string;
  league?: string;
  venue?: string;
  teams: DuprTeam[];
}

interface DuprHistoryResponse {
  status: string;
  result: {
    hits: DuprMatchHit[];
    total?: number;
  };
}

async function getPlayersNeedingMatches(limit: number): Promise<PlayerNeedingMatches[]> {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - STALE_DAYS);

  const { data, error } = await supabase
    .from("players")
    .select("id, name, dupr_id")
    .not("dupr_id", "is", null)
    .eq("dupr_verified", true)
    .or(`matches_last_checked.is.null,matches_last_checked.lt.${staleDate.toISOString()}`)
    .order("matches_last_checked", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error("[match-history] Error fetching players needing matches:", error);
    return [];
  }

  return (data ?? []) as PlayerNeedingMatches[];
}

async function getNumericId(
  duprId: string,
  token: string,
  attempt = 0
): Promise<number | null> {
  const res = await fetch(`${DUPR_API_BASE}/player/v1.0/search`, {
    method: "POST",
    headers: apiHeaders(token),
    body: JSON.stringify({
      query: duprId,
      limit: 5,
      offset: 0,
      includeUnclaimedPlayers: true,
      filter: {},
    }),
  });

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) {
      console.error(`[match-history] Rate limited ${MAX_RETRIES + 1}x searching "${duprId}", giving up`);
      return null;
    }
    const wait = backoffDelay();
    console.warn(`[match-history] Rate limited, backing off ${(wait / 1000).toFixed(0)}s (attempt ${attempt + 1})...`);
    await sleep(wait);
    return getNumericId(duprId, token, attempt + 1);
  }

  if (!res.ok) {
    console.error(`[match-history] Search failed for duprId "${duprId}": ${res.status}`);
    return null;
  }

  const data = await res.json() as { status: string; result: { hits: DuprSearchHit[] } };
  const hits: DuprSearchHit[] = data.result?.hits ?? [];

  // Find exact match by duprId
  const match = hits.find((h) => h.duprId === duprId) ?? hits[0] ?? null;
  return match?.id ?? null;
}

async function fetchMatchHistory(
  numericId: number,
  token: string,
  attempt = 0
): Promise<DuprMatchHit[]> {
  const res = await fetch(`${DUPR_API_BASE}/player/v1.0/${numericId}/history`, {
    method: "POST",
    headers: apiHeaders(token),
    body: JSON.stringify({
      filters: {},
      sort: { order: "DESC", parameter: "MATCH_DATE" },
      limit: 25,
      offset: 0,
    }),
  });

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) {
      console.error(`[match-history] Rate limited ${MAX_RETRIES + 1}x for player ${numericId}, giving up`);
      return [];
    }
    const wait = backoffDelay();
    console.warn(`[match-history] Rate limited, backing off ${(wait / 1000).toFixed(0)}s (attempt ${attempt + 1})...`);
    await sleep(wait);
    return fetchMatchHistory(numericId, token, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[match-history] History fetch failed for player ${numericId}: ${res.status} ${body.slice(0, 200)}`);
    return [];
  }

  const data = await res.json() as DuprHistoryResponse;
  return data.result?.hits ?? [];
}

/**
 * Resolve a DUPR alphanumeric ID to our internal player UUID.
 * Returns null if not found in our database.
 */
async function resolvePlayerUuid(duprId: string | undefined): Promise<string | null> {
  if (!duprId) return null;

  const { data, error } = await supabase
    .from("players")
    .select("id")
    .eq("dupr_id", duprId)
    .maybeSingle();

  if (error) {
    console.error(`[match-history] Error resolving duprId "${duprId}":`, error);
    return null;
  }

  return data?.id ?? null;
}

/**
 * Normalize a score value: DUPR uses -1 to mean "not played".
 * We store null for unplayed games.
 */
function normalizeScore(score: number | undefined): number | null {
  if (score === undefined || score === null || score < 0) return null;
  return score;
}

interface MatchRow {
  id: string;
  dupr_match_id: number;
  event_date: string;
  event_format: string;
  league: string | null;
  venue: string | null;
  team1_player1_id: string | null;
  team1_player2_id: string | null;
  team1_player1_name: string;
  team1_player2_name: string | null;
  team2_player1_id: string | null;
  team2_player2_id: string | null;
  team2_player1_name: string;
  team2_player2_name: string | null;
  game1_team1: number | null;
  game1_team2: number | null;
  game2_team1: number | null;
  game2_team2: number | null;
  game3_team1: number | null;
  game3_team2: number | null;
  team1_won: boolean;
  created_at: string;
}

async function upsertMatches(matches: DuprMatchHit[]): Promise<number> {
  if (matches.length === 0) return 0;

  const rows: MatchRow[] = [];

  for (const match of matches) {
    const team1 = match.teams.find((t) => t.serial === 1);
    const team2 = match.teams.find((t) => t.serial === 2);

    if (!team1 || !team2) {
      console.warn(`[match-history] Skipping match ${match.matchId}: missing team data`);
      continue;
    }

    if (!team1.player1?.fullName || !team2.player1?.fullName) {
      console.warn(`[match-history] Skipping match ${match.matchId}: missing player names`);
      continue;
    }

    // Resolve player UUIDs from DUPR IDs (in parallel)
    const [t1p1Id, t1p2Id, t2p1Id, t2p2Id] = await Promise.all([
      resolvePlayerUuid(team1.player1.duprId),
      resolvePlayerUuid(team1.player2?.duprId),
      resolvePlayerUuid(team2.player1.duprId),
      resolvePlayerUuid(team2.player2?.duprId),
    ]);

    rows.push({
      id: crypto.randomUUID(),
      dupr_match_id: match.matchId,
      event_date: match.eventDate,
      event_format: match.eventFormat,
      league: match.league ?? null,
      venue: match.venue ?? null,
      team1_player1_id: t1p1Id,
      team1_player2_id: t1p2Id,
      team1_player1_name: team1.player1.fullName,
      team1_player2_name: team1.player2?.fullName ?? null,
      team2_player1_id: t2p1Id,
      team2_player2_id: t2p2Id,
      team2_player1_name: team2.player1.fullName,
      team2_player2_name: team2.player2?.fullName ?? null,
      game1_team1: normalizeScore(team1.game1),
      game1_team2: normalizeScore(team2.game1),
      game2_team1: normalizeScore(team1.game2),
      game2_team2: normalizeScore(team2.game2),
      game3_team1: normalizeScore(team1.game3),
      game3_team2: normalizeScore(team2.game3),
      team1_won: team1.winner,
      created_at: new Date().toISOString(),
    });
  }

  if (rows.length === 0) return 0;

  const { error, count } = await supabase
    .from("matches")
    .upsert(rows, { onConflict: "dupr_match_id", ignoreDuplicates: false })
    .select();

  if (error) {
    console.error("[match-history] Upsert failed:", error);
    return 0;
  }

  return count ?? rows.length;
}

export async function fetchAllMatchHistory(token: string): Promise<{
  playersChecked: number;
  matchesInserted: number;
}> {
  console.log("[match-history] Starting match history fetch...");

  const players = await getPlayersNeedingMatches(BATCH_SIZE);
  console.log(`[match-history] Found ${players.length} players needing match history refresh`);

  let matchesInserted = 0;

  for (const player of players) {
    try {
      // Step 1: Resolve numeric DUPR ID
      const numericId = await getNumericId(player.dupr_id, token);
      if (!numericId) {
        console.warn(`[match-history] Could not resolve numeric ID for "${player.name}" (${player.dupr_id})`);
        await supabase
          .from("players")
          .update({ matches_last_checked: new Date().toISOString() })
          .eq("id", player.id);
        const delay = humanDelay();
        await sleep(delay);
        continue;
      }

      // Brief pause between search and history fetch
      await sleep(randBetween(800, 2000));

      // Step 2: Fetch match history
      const hits = await fetchMatchHistory(numericId, token);
      console.log(`[match-history] ${player.name}: fetched ${hits.length} matches`);

      // Step 3: Upsert matches
      const inserted = await upsertMatches(hits);
      matchesInserted += inserted;

      // Step 4: Update player's matches_last_checked
      const { error: updateError } = await supabase
        .from("players")
        .update({ matches_last_checked: new Date().toISOString() })
        .eq("id", player.id);

      if (updateError) {
        console.error(`[match-history] Failed to update matches_last_checked for "${player.name}":`, updateError);
      } else {
        console.log(`[match-history] ✓ ${player.name}: ${inserted} matches upserted`);
      }
    } catch (err) {
      console.error(`[match-history] Error processing "${player.name}":`, err);
    }

    const delay = humanDelay();
    await sleep(delay);
  }

  console.log(
    `[match-history] Done. Players checked: ${players.length}, Matches inserted/updated: ${matchesInserted}`
  );

  return { playersChecked: players.length, matchesInserted };
}
