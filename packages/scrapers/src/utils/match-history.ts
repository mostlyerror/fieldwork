import { supabase } from "./supabase.js";
import { duprFetch } from "./dupr-fetch.js";

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
  postMatchRating?: { singles: number | null; doubles: number | null };
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
  preMatchRatingAndImpact?: {
    preMatchDoubleRatingPlayer1: number | null;
    matchDoubleRatingImpactPlayer1: number | null;
    preMatchDoubleRatingPlayer2: number | null;
    matchDoubleRatingImpactPlayer2: number | null;
  };
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
  const res = await duprFetch(`${DUPR_API_BASE}/player/v1.0/search`, {
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

const HISTORY_PAGE = 25; // DUPR caps the history limit at 25 per request
const MAX_HISTORY = 150; // cap matches pulled per player (enough for a trend)

async function fetchMatchPage(
  numericId: number,
  token: string,
  offset: number,
  attempt = 0
): Promise<{ hits: DuprMatchHit[]; total: number }> {
  const res = await duprFetch(`${DUPR_API_BASE}/player/v1.0/${numericId}/history`, {
    method: "POST",
    headers: apiHeaders(token),
    body: JSON.stringify({
      filters: {},
      sort: { order: "DESC", parameter: "MATCH_DATE" },
      limit: HISTORY_PAGE,
      offset,
    }),
  });

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) {
      console.error(`[match-history] Rate limited ${MAX_RETRIES + 1}x for player ${numericId}, giving up`);
      return { hits: [], total: 0 };
    }
    const wait = backoffDelay();
    console.warn(`[match-history] Rate limited, backing off ${(wait / 1000).toFixed(0)}s (attempt ${attempt + 1})...`);
    await sleep(wait);
    return fetchMatchPage(numericId, token, offset, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[match-history] History fetch failed for player ${numericId}: ${res.status} ${body.slice(0, 200)}`);
    return { hits: [], total: 0 };
  }

  const data = await res.json() as DuprHistoryResponse;
  return { hits: data.result?.hits ?? [], total: data.result?.total ?? 0 };
}

/** Paginate a player's match history up to MAX_HISTORY (most recent first). */
async function fetchMatchHistory(numericId: number, token: string): Promise<DuprMatchHit[]> {
  const all: DuprMatchHit[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < Math.min(total, MAX_HISTORY)) {
    const { hits, total: t } = await fetchMatchPage(numericId, token, offset);
    total = t || all.length; // if total missing, stop after this page
    if (hits.length === 0) break;
    all.push(...hits);
    offset += HISTORY_PAGE;
    if (hits.length < HISTORY_PAGE) break;
    if (offset < Math.min(total, MAX_HISTORY)) await sleep(randBetween(800, 1800));
  }
  return all;
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

interface RatingRow {
  player_id: string;
  dupr_match_id: number;
  event_date: string;
  format: string;
  rating: number;
  pre_rating: number | null;
  impact: number | null;
}

/** Pull THIS player's post-match doubles rating out of each match they're in. */
function buildRatingRows(
  matches: DuprMatchHit[],
  playerDuprId: string,
  playerUuid: string,
): RatingRow[] {
  const rows: RatingRow[] = [];
  const seen = new Set<number>();
  for (const m of matches) {
    for (const team of m.teams) {
      const slot = team.player1?.duprId === playerDuprId ? 1 : team.player2?.duprId === playerDuprId ? 2 : 0;
      if (!slot) continue;
      const player = slot === 1 ? team.player1 : team.player2;
      const post = player?.postMatchRating?.doubles;
      if (post == null) continue;
      if (seen.has(m.matchId)) continue;
      seen.add(m.matchId);
      const pim = team.preMatchRatingAndImpact;
      rows.push({
        player_id: playerUuid,
        dupr_match_id: m.matchId,
        event_date: m.eventDate,
        format: "DOUBLES",
        rating: post,
        pre_rating: slot === 1 ? pim?.preMatchDoubleRatingPlayer1 ?? null : pim?.preMatchDoubleRatingPlayer2 ?? null,
        impact: slot === 1 ? pim?.matchDoubleRatingImpactPlayer1 ?? null : pim?.matchDoubleRatingImpactPlayer2 ?? null,
      });
    }
  }
  return rows;
}

async function upsertRatingHistory(rows: RatingRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error, count } = await supabase
    .from("player_rating_history")
    .upsert(rows, { onConflict: "player_id,dupr_match_id,format", ignoreDuplicates: false })
    .select();
  if (error) {
    console.error("[match-history] rating-history upsert failed:", error);
    return 0;
  }
  return count ?? rows.length;
}

/**
 * The player's known doubles rating BEFORE this run, used as the "before" in
 * the Discord delta. Prefers the most recent rating_history row (the value we
 * displayed last time); falls back to the players.dupr_doubles column. Returns
 * null when neither exists, so we render the current rating without a fake delta.
 */
async function getPriorRating(playerId: string): Promise<number | null> {
  const { data: hist } = await supabase
    .from("player_rating_history")
    .select("rating")
    .eq("player_id", playerId)
    .eq("format", "DOUBLES")
    .order("event_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (hist?.rating != null) return hist.rating as number;

  const { data: player } = await supabase
    .from("players")
    .select("dupr_doubles")
    .eq("id", playerId)
    .maybeSingle();
  return (player?.dupr_doubles as number | null) ?? null;
}

/** Latest (most recent event_date) doubles rating out of freshly built rows. */
function latestRating(rows: RatingRow[]): number | null {
  let best: RatingRow | null = null;
  for (const r of rows) {
    if (r.format !== "DOUBLES") continue;
    if (!best || r.event_date > best.event_date) best = r;
  }
  return best?.rating ?? null;
}

/** Per-player summary surfaced in the Discord refresh alert. */
export interface PlayerHistorySummary {
  name: string;
  /** Known rating before this run (null when we can't compute honestly). */
  ratingBefore: number | null;
  /** Most recent rating after this run (null if no rating points found). */
  ratingAfter: number | null;
  matchesAdded: number;
}

/**
 * Fetch + store one player's matches and rating timeline.
 * Returns matches upserted plus a per-player summary for the Discord alert.
 */
async function processPlayer(
  player: PlayerNeedingMatches,
  token: string,
): Promise<{ inserted: number; summary: PlayerHistorySummary }> {
  const summary: PlayerHistorySummary = {
    name: player.name,
    ratingBefore: null,
    ratingAfter: null,
    matchesAdded: 0,
  };
  try {
    const numericId = await getNumericId(player.dupr_id, token);
    if (!numericId) {
      console.warn(`[match-history] Could not resolve numeric ID for "${player.name}" (${player.dupr_id})`);
      await supabase.from("players").update({ matches_last_checked: new Date().toISOString() }).eq("id", player.id);
      return { inserted: 0, summary };
    }

    // Snapshot the rating we knew BEFORE upserting this run's data, so the
    // before→after delta is honest (or null when there's nothing to compare).
    summary.ratingBefore = await getPriorRating(player.id);

    await sleep(randBetween(800, 2000)); // pause between search and history fetch

    const hits = await fetchMatchHistory(numericId, token);
    console.log(`[match-history] ${player.name}: fetched ${hits.length} matches`);

    const inserted = await upsertMatches(hits);

    // Capture this player's rating timeline from the same data
    const ratingRows = buildRatingRows(hits, player.dupr_id, player.id);
    const ratingPoints = await upsertRatingHistory(ratingRows);
    if (ratingPoints > 0) console.log(`[match-history]   ${player.name}: ${ratingPoints} rating points`);

    summary.ratingAfter = latestRating(ratingRows) ?? summary.ratingBefore;
    summary.matchesAdded = inserted;

    const { error: updateError } = await supabase
      .from("players")
      .update({ matches_last_checked: new Date().toISOString() })
      .eq("id", player.id);
    if (updateError) console.error(`[match-history] Failed to update matches_last_checked for "${player.name}":`, updateError);
    else console.log(`[match-history] ✓ ${player.name}: ${inserted} matches upserted`);

    return { inserted, summary };
  } catch (err) {
    console.error(`[match-history] Error processing "${player.name}":`, err);
    // Mark attempted so a failing player isn't retried every hour by the
    // new-player pass — it falls back to the slower full-scrape staleness retry.
    try {
      await supabase.from("players").update({ matches_last_checked: new Date().toISOString() }).eq("id", player.id);
    } catch {
      /* best-effort */
    }
    return { inserted: 0, summary };
  }
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
    const { inserted } = await processPlayer(player, token);
    matchesInserted += inserted;
    await sleep(humanDelay());
  }

  console.log(`[match-history] Done. Players checked: ${players.length}, Matches inserted/updated: ${matchesInserted}`);
  return { playersChecked: players.length, matchesInserted };
}

// TDs often enter DUPR results days after an event, so keep refreshing a
// tournament's roster for this many days past its end date to catch them.
const POST_EVENT_DAYS = 14;
const FRESH_FLOOR_HOURS = 24; // don't re-pull a player within 24h (ratings move slowly)

/**
 * Players rostered in tournaments that are upcoming, active, or ended within
 * the post-event window, verified with a dupr_id, and not fetched within 24h.
 * Done server-side via RPC (the roster can be 1000+ players — too many for an
 * IN-list URL). Refreshing by roster keeps a tournament's field intel complete.
 */
async function getRosterPlayersToRefresh(limit: number): Promise<PlayerNeedingMatches[]> {
  const { data, error } = await supabase.rpc("get_roster_players_to_refresh", {
    post_event_days: POST_EVENT_DAYS,
    fresh_floor_hours: FRESH_FLOOR_HOURS,
    lim: limit,
  });
  if (error) {
    console.error("[match-history] roster refresh query failed:", error);
    return [];
  }
  return (data ?? []) as PlayerNeedingMatches[];
}

/**
 * Metered, tournament-roster-driven history refresh. Called from the hourly
 * urgent refresh: refreshes up to `limit` players rostered in current/recent
 * tournaments who are new or >24h stale — so a tournament's field intel stays
 * complete and current (incl. late-entered TD results) without bursting DUPR.
 */
export async function fetchTournamentRosterHistory(
  token: string,
  limit = 5,
): Promise<{
  playersChecked: number;
  matchesInserted: number;
  players: PlayerHistorySummary[];
}> {
  const players = await getRosterPlayersToRefresh(limit);
  if (players.length === 0) return { playersChecked: 0, matchesInserted: 0, players: [] };
  console.log(`[match-history] Roster refresh: ${players.length} player(s)`);

  let matchesInserted = 0;
  const summaries: PlayerHistorySummary[] = [];
  for (const player of players) {
    const { inserted, summary } = await processPlayer(player, token);
    matchesInserted += inserted;
    summaries.push(summary);
    await sleep(humanDelay());
  }
  return { playersChecked: players.length, matchesInserted, players: summaries };
}
