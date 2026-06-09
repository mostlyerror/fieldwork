/**
 * Per-player DUPR pulls and the shared pull queue.
 *
 * One pull = profile (live ratings + per-format verified/provisional flags) +
 * full match history (matches + rating timeline), stamping dupr_last_checked
 * and matches_last_checked together. Every scheduled job drains the SAME
 * queue (get_dupr_pull_queue — roster-priority tiers, then staleness),
 * differing only in cap. All DUPR HTTP goes through utils/dupr-client.ts,
 * which owns auth, pacing, retries, and the global daily budget.
 */
import { supabase } from "./supabase.js";
import {
  duprSearch,
  duprHistoryPage,
  duprProfile,
  parseRatings,
  HISTORY_PAGE,
  DuprAuthFailed,
  DuprBudgetExhausted,
  DuprCircuitOpen,
  type DuprMatchHit,
} from "./dupr-client.js";

const MAX_HISTORY = 150; // cap matches pulled per player (enough for a trend)

// TDs often enter DUPR results days after an event, so keep refreshing a
// tournament's roster for this many days past its end date to catch them.
const POST_EVENT_DAYS = 14;
const FRESH_FLOOR_HOURS = 24; // don't re-pull a player within 24h (ratings move slowly)
const STALE_DAYS = 7; // non-rostered players re-enter the queue after this long

interface QueuedPlayer {
  id: string;
  name: string;
  dupr_id: string;
  dupr_numeric_id: number | null;
}

/**
 * The one selector: rostered-and-just-competed first, then rostered-new, then
 * general staleness (see migration 034). Replaces the separate roster RPC and
 * matches_last_checked scan that used to compete for the same players.
 */
async function getPullQueue(limit: number): Promise<QueuedPlayer[]> {
  const { data, error } = await supabase.rpc("get_dupr_pull_queue", {
    post_event_days: POST_EVENT_DAYS,
    fresh_floor_hours: FRESH_FLOOR_HOURS,
    stale_days: STALE_DAYS,
    lim: limit,
  });
  if (error) {
    console.error("[match-history] pull queue query failed:", error);
    return [];
  }
  return (data ?? []) as QueuedPlayer[];
}

/**
 * DUPR's numeric id never changes — resolve it once via search, cache it on
 * the players row, and every later pull skips the search request entirely
 * (~⅓ of repeat-pull volume).
 */
async function resolveNumericId(player: QueuedPlayer): Promise<number | null> {
  if (player.dupr_numeric_id != null) return player.dupr_numeric_id;

  const hits = await duprSearch(player.dupr_id, 5);
  const numericId = (hits.find((h) => h.duprId === player.dupr_id) ?? hits[0])?.id ?? null;
  if (numericId == null) return null;

  const { error } = await supabase
    .from("players")
    .update({ dupr_numeric_id: numericId })
    .eq("id", player.id);
  if (error) console.error(`[match-history] Failed to cache numeric id for "${player.name}":`, error);
  return numericId;
}

/**
 * Refresh the player's live ratings + verified/provisional flags — rides along
 * with every history pull, so ratings freshness no longer needs a separate
 * search-based pass. Prefers the profile endpoint (carries the per-format
 * verified/provisional flags); falls back to a dupr_id search (the old
 * enrichment path) if the profile fetch fails. Best-effort: a miss here never
 * blocks the history pull.
 */
async function applyProfileRatings(player: QueuedPlayer, numericId: number): Promise<void> {
  const playerId = player.id;
  const name = player.name;
  let ratings = (await duprProfile(numericId))?.ratings;
  if (!ratings) {
    const hits = await duprSearch(player.dupr_id, 5);
    ratings = (hits.find((h) => h.duprId === player.dupr_id) ?? hits[0])?.ratings;
  }
  if (!ratings) return;
  const r = parseRatings(ratings);
  if (r.doubles == null && r.singles == null) return; // nothing rated — leave row alone

  const { error } = await supabase
    .from("players")
    .update({
      ...(r.doubles != null ? { dupr_doubles: r.doubles } : {}),
      dupr_doubles_verified: r.doublesVerified,
      dupr_doubles_provisional: r.doublesProvisional,
      ...(r.singles != null ? { dupr_singles: r.singles } : {}),
      dupr_singles_verified: r.singlesVerified,
      dupr_singles_provisional: r.singlesProvisional,
      dupr_last_checked: new Date().toISOString(),
    })
    .eq("id", playerId);
  if (error) console.error(`[match-history] Profile ratings update failed for "${name}":`, error);
}

/** Paginate a player's match history up to MAX_HISTORY (most recent first). */
async function fetchFullHistory(numericId: number): Promise<DuprMatchHit[]> {
  const all: DuprMatchHit[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < Math.min(total, MAX_HISTORY)) {
    const { hits, total: t } = await duprHistoryPage(numericId, offset);
    total = t || all.length; // if total missing, stop after this page
    if (hits.length === 0) break;
    all.push(...hits);
    offset += HISTORY_PAGE;
    if (hits.length < HISTORY_PAGE) break;
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

/** Run-stopping conditions — propagate out of the per-player handling. */
function isRunAbort(err: unknown): boolean {
  return (
    err instanceof DuprBudgetExhausted ||
    err instanceof DuprCircuitOpen ||
    err instanceof DuprAuthFailed
  );
}

/**
 * One full pull for one player: profile (ratings + verified/provisional) +
 * match history + rating timeline. Stamps matches_last_checked.
 */
async function processPlayer(
  player: QueuedPlayer,
): Promise<{ inserted: number; summary: PlayerHistorySummary }> {
  const summary: PlayerHistorySummary = {
    name: player.name,
    ratingBefore: null,
    ratingAfter: null,
    matchesAdded: 0,
  };
  try {
    const numericId = await resolveNumericId(player);
    if (!numericId) {
      console.warn(`[match-history] Could not resolve numeric ID for "${player.name}" (${player.dupr_id})`);
      await supabase.from("players").update({ matches_last_checked: new Date().toISOString() }).eq("id", player.id);
      return { inserted: 0, summary };
    }

    // Snapshot the rating we knew BEFORE upserting this run's data, so the
    // before→after delta is honest (or null when there's nothing to compare).
    summary.ratingBefore = await getPriorRating(player.id);

    // Ratings + per-format verified/provisional ride along with every pull.
    await applyProfileRatings(player, numericId);

    const hits = await fetchFullHistory(numericId);
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
    // Budget/circuit/auth aborts belong to the RUN, not this player — don't
    // stamp them as attempted (they weren't), let the drain loop stop cleanly.
    if (isRunAbort(err)) throw err;
    console.error(`[match-history] Error processing "${player.name}":`, err);
    // Mark attempted so a failing player isn't retried every hour — it falls
    // back to the staleness retry instead.
    try {
      await supabase.from("players").update({ matches_last_checked: new Date().toISOString() }).eq("id", player.id);
    } catch {
      /* best-effort */
    }
    return { inserted: 0, summary };
  }
}

/**
 * Drain up to `limit` players from the shared pull queue. THE entry point for
 * every scheduled job (hourly roster pass caps at 12, twice-daily enrich at 30)
 * — same queue, same priority, different cap. Ends gracefully (partial results)
 * when the daily budget runs out or the circuit breaker trips.
 */
export async function pullQueuedPlayers(limit: number): Promise<{
  playersChecked: number;
  matchesInserted: number;
  players: PlayerHistorySummary[];
}> {
  const players = await getPullQueue(limit);
  if (players.length === 0) return { playersChecked: 0, matchesInserted: 0, players: [] };
  console.log(`[match-history] Pull queue: ${players.length} player(s)`);

  let matchesInserted = 0;
  const summaries: PlayerHistorySummary[] = [];
  for (const player of players) {
    try {
      const { inserted, summary } = await processPlayer(player);
      matchesInserted += inserted;
      summaries.push(summary);
    } catch (err) {
      if (isRunAbort(err)) {
        console.warn(`[match-history] Stopping run early: ${(err as Error).message}`);
        break;
      }
      throw err;
    }
  }
  return { playersChecked: summaries.length, matchesInserted, players: summaries };
}

/**
 * Force-refresh a single player by our player UUID, ignoring the queue and
 * staleness gating. Backs the on-demand "pull this player now" path (and a
 * future "refresh me" button). Returns null if the player has no dupr_id.
 */
export async function fetchPlayerMatchHistory(
  playerId: string,
): Promise<{ matchesInserted: number; summary: PlayerHistorySummary } | null> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, dupr_id, dupr_numeric_id")
    .eq("id", playerId)
    .not("dupr_id", "is", null)
    .maybeSingle();
  if (error || !data) {
    console.error(`[match-history] player ${playerId} not found or has no dupr_id`);
    return null;
  }
  const { inserted, summary } = await processPlayer(data as QueuedPlayer);
  return { matchesInserted: inserted, summary };
}
