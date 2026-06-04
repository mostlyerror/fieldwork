/**
 * Targeted backfill for a single player by DUPR id: pulls their full match
 * history from DUPR and populates BOTH `matches` (the match list) and
 * `player_rating_history` (the rating trend), then stamps matches_last_checked.
 *
 *   npx tsx packages/scrapers/src/backfill-player.ts <DUPR_ID>
 *
 * Requires DUPR_EMAIL, DUPR_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { supabase } from "./utils/supabase.js";

const API = "https://api.dupr.gg";
const PAGE = 25; // DUPR caps history limit at 25
const MAX = 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a));
const norm = (n?: number) => (n == null || n < 0 ? null : n);

function headers(token?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface TP { duprId?: string; fullName: string; postMatchRating?: { doubles: number | null } }
interface Team { serial: number; player1?: TP; player2?: TP; game1?: number; game2?: number; game3?: number; winner: boolean;
  preMatchRatingAndImpact?: { preMatchDoubleRatingPlayer1: number | null; matchDoubleRatingImpactPlayer1: number | null; preMatchDoubleRatingPlayer2: number | null; matchDoubleRatingImpactPlayer2: number | null } }
interface Hit { matchId: number; eventDate: string; eventFormat: string; league?: string; venue?: string; teams: Team[] }

async function main() {
  const duprId = process.argv[2];
  if (!duprId) { console.error("usage: backfill-player.ts <DUPR_ID>"); process.exit(1); }

  const { data: me } = await supabase.from("players").select("id, name").eq("dupr_id", duprId).maybeSingle();
  if (!me) { console.error(`No player with dupr_id ${duprId}`); process.exit(1); }
  console.log(`Player: ${me.name} (${me.id})`);

  const lr = await fetch(`${API}/auth/v1.0/login/`, { method: "POST", headers: headers(), body: JSON.stringify({ email: process.env.DUPR_EMAIL, password: process.env.DUPR_PASSWORD }) });
  const ld = await lr.json();
  if (ld?.status !== "SUCCESS") { console.error("login failed"); process.exit(1); }
  const tok = ld.result.accessToken;

  const sr = await fetch(`${API}/player/v1.0/search`, { method: "POST", headers: headers(tok), body: JSON.stringify({ query: duprId, limit: 5, offset: 0, includeUnclaimedPlayers: true, filter: {} }) });
  const sd = await sr.json();
  const nid = ((sd.result?.hits ?? []).find((h: { duprId?: string }) => h.duprId === duprId) ?? sd.result?.hits?.[0])?.id;
  if (!nid) { console.error("no numeric id"); process.exit(1); }
  await sleep(rand(700, 1500));

  // paginate history
  const hits: Hit[] = [];
  let offset = 0, total = Infinity;
  while (offset < Math.min(total, MAX)) {
    const r = await fetch(`${API}/player/v1.0/${nid}/history`, { method: "POST", headers: headers(tok), body: JSON.stringify({ filters: {}, sort: { order: "DESC", parameter: "MATCH_DATE" }, limit: PAGE, offset }) });
    if (!r.ok) break;
    const d = await r.json();
    const h: Hit[] = d?.result?.hits ?? [];
    total = d?.result?.total ?? hits.length;
    if (!h.length) break;
    hits.push(...h);
    offset += PAGE;
    if (h.length < PAGE) break;
    if (offset < Math.min(total, MAX)) await sleep(rand(800, 1700));
  }
  console.log(`Fetched ${hits.length} matches (total ${total}).`);

  // dupr_id -> our player_id map (for linking opponents/partners)
  const ids = new Set<string>();
  for (const m of hits) for (const t of m.teams) for (const p of [t.player1, t.player2]) if (p?.duprId) ids.add(p.duprId);
  const { data: known } = await supabase.from("players").select("id, dupr_id").in("dupr_id", [...ids]);
  const uuid = new Map<string, string>((known ?? []).map((k) => [k.dupr_id as string, k.id as string]));

  // build matches + rating rows
  const matchRows: Record<string, unknown>[] = [];
  const ratingRows: Record<string, unknown>[] = [];
  const seenRating = new Set<number>();
  for (const m of hits) {
    const t1 = m.teams.find((t) => t.serial === 1);
    const t2 = m.teams.find((t) => t.serial === 2);
    if (!t1?.player1?.fullName || !t2?.player1?.fullName) continue;
    matchRows.push({
      id: crypto.randomUUID(), dupr_match_id: m.matchId, event_date: m.eventDate, event_format: m.eventFormat,
      league: m.league ?? null, venue: m.venue ?? null,
      team1_player1_id: uuid.get(t1.player1.duprId ?? "") ?? null, team1_player1_name: t1.player1.fullName,
      team1_player2_id: uuid.get(t1.player2?.duprId ?? "") ?? null, team1_player2_name: t1.player2?.fullName ?? null,
      team2_player1_id: uuid.get(t2.player1.duprId ?? "") ?? null, team2_player1_name: t2.player1.fullName,
      team2_player2_id: uuid.get(t2.player2?.duprId ?? "") ?? null, team2_player2_name: t2.player2?.fullName ?? null,
      game1_team1: norm(t1.game1), game1_team2: norm(t2.game1),
      game2_team1: norm(t1.game2), game2_team2: norm(t2.game2),
      game3_team1: norm(t1.game3), game3_team2: norm(t2.game3),
      team1_won: t1.winner, created_at: new Date().toISOString(),
    });
    // rating point for our player
    for (const t of m.teams) {
      const slot = t.player1?.duprId === duprId ? 1 : t.player2?.duprId === duprId ? 2 : 0;
      if (!slot) continue;
      const post = (slot === 1 ? t.player1 : t.player2)?.postMatchRating?.doubles;
      if (post == null || seenRating.has(m.matchId)) continue;
      seenRating.add(m.matchId);
      const pim = t.preMatchRatingAndImpact;
      ratingRows.push({ player_id: me.id, dupr_match_id: m.matchId, event_date: m.eventDate, format: "DOUBLES", rating: post,
        pre_rating: slot === 1 ? pim?.preMatchDoubleRatingPlayer1 ?? null : pim?.preMatchDoubleRatingPlayer2 ?? null,
        impact: slot === 1 ? pim?.matchDoubleRatingImpactPlayer1 ?? null : pim?.matchDoubleRatingImpactPlayer2 ?? null });
    }
  }

  if (matchRows.length) {
    const { error } = await supabase.from("matches").upsert(matchRows, { onConflict: "dupr_match_id", ignoreDuplicates: false });
    console.log(error ? `matches err: ${error.message}` : `✓ ${matchRows.length} matches`);
  }
  if (ratingRows.length) {
    const { error } = await supabase.from("player_rating_history").upsert(ratingRows, { onConflict: "player_id,dupr_match_id,format", ignoreDuplicates: false });
    console.log(error ? `ratings err: ${error.message}` : `✓ ${ratingRows.length} rating points`);
  }
  await supabase.from("players").update({ matches_last_checked: new Date().toISOString() }).eq("id", me.id);
  console.log("done.");
}

main();
