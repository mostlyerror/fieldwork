/**
 * One-off backfill: populate player_rating_history from DUPR for verified
 * players that have a dupr_id. Reuses the same /history data the match-history
 * job fetches — pulls each player's post-match doubles rating timeline.
 *
 *   npx tsx packages/scrapers/src/backfill-rating-history.ts [limit]
 *
 * Requires DUPR_EMAIL, DUPR_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { supabase } from "./utils/supabase.js";

const API = "https://api.dupr.gg";
const PAGE = 25; // DUPR caps history limit at 25
const MAX = 150;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a));

function headers(token?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface Player { id: string; name: string; dupr_id: string }

async function login(): Promise<string | null> {
  const r = await fetch(`${API}/auth/v1.0/login/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email: process.env.DUPR_EMAIL, password: process.env.DUPR_PASSWORD }),
  });
  const d = await r.json();
  return d?.status === "SUCCESS" ? d.result.accessToken : null;
}

async function numericId(duprId: string, token: string): Promise<number | null> {
  const r = await fetch(`${API}/player/v1.0/search`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ query: duprId, limit: 5, offset: 0, includeUnclaimedPlayers: true, filter: {} }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  const hits = d?.result?.hits ?? [];
  return (hits.find((h: { duprId?: string }) => h.duprId === duprId) ?? hits[0])?.id ?? null;
}

interface Hit {
  matchId: number;
  eventDate: string;
  teams: {
    player1?: { duprId?: string; postMatchRating?: { doubles: number | null } };
    player2?: { duprId?: string; postMatchRating?: { doubles: number | null } };
    preMatchRatingAndImpact?: {
      preMatchDoubleRatingPlayer1: number | null; matchDoubleRatingImpactPlayer1: number | null;
      preMatchDoubleRatingPlayer2: number | null; matchDoubleRatingImpactPlayer2: number | null;
    };
  }[];
}

async function history(nid: number, token: string): Promise<Hit[]> {
  const all: Hit[] = [];
  let offset = 0, total = Infinity;
  while (offset < Math.min(total, MAX)) {
    const r = await fetch(`${API}/player/v1.0/${nid}/history`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ filters: {}, sort: { order: "DESC", parameter: "MATCH_DATE" }, limit: PAGE, offset }),
    });
    if (!r.ok) break;
    const d = await r.json();
    const hits: Hit[] = d?.result?.hits ?? [];
    total = d?.result?.total ?? all.length;
    if (!hits.length) break;
    all.push(...hits);
    offset += PAGE;
    if (hits.length < PAGE) break;
    if (offset < Math.min(total, MAX)) await sleep(rand(800, 1800));
  }
  return all;
}

function rows(hits: Hit[], duprId: string, uuid: string) {
  const out: { player_id: string; dupr_match_id: number; event_date: string; format: string; rating: number; pre_rating: number | null; impact: number | null }[] = [];
  const seen = new Set<number>();
  for (const m of hits) {
    for (const t of m.teams) {
      const slot = t.player1?.duprId === duprId ? 1 : t.player2?.duprId === duprId ? 2 : 0;
      if (!slot) continue;
      const post = (slot === 1 ? t.player1 : t.player2)?.postMatchRating?.doubles;
      if (post == null || seen.has(m.matchId)) continue;
      seen.add(m.matchId);
      const pim = t.preMatchRatingAndImpact;
      out.push({
        player_id: uuid, dupr_match_id: m.matchId, event_date: m.eventDate, format: "DOUBLES", rating: post,
        pre_rating: slot === 1 ? pim?.preMatchDoubleRatingPlayer1 ?? null : pim?.preMatchDoubleRatingPlayer2 ?? null,
        impact: slot === 1 ? pim?.matchDoubleRatingImpactPlayer1 ?? null : pim?.matchDoubleRatingImpactPlayer2 ?? null,
      });
    }
  }
  return out;
}

async function main() {
  const limit = parseInt(process.argv[2] ?? "12", 10);
  const token = await login();
  if (!token) { console.error("login failed"); process.exit(1); }
  console.log("login ok");

  // Prefer players who appear in our event_players (i.e. show up on the site)
  const { data: players } = await supabase
    .from("players")
    .select("id, name, dupr_id")
    .not("dupr_id", "is", null)
    .eq("dupr_verified", true)
    .limit(limit);

  let totalPoints = 0;
  for (const p of (players ?? []) as Player[]) {
    try {
      const nid = await numericId(p.dupr_id, token);
      if (!nid) { console.log(`- ${p.name}: no numeric id`); await sleep(rand(800, 2000)); continue; }
      await sleep(rand(700, 1600));
      const hits = await history(nid, token);
      const r = rows(hits, p.dupr_id, p.id);
      if (r.length) {
        const { error } = await supabase.from("player_rating_history").upsert(r, { onConflict: "player_id,dupr_match_id,format", ignoreDuplicates: false });
        if (error) console.error(`  ${p.name} upsert err:`, error.message);
        else { totalPoints += r.length; console.log(`✓ ${p.name}: ${r.length} rating points (${hits.length} matches)`); }
      } else {
        console.log(`- ${p.name}: 0 rating points (${hits.length} matches)`);
      }
    } catch (e) {
      console.error(`  ${p.name} error:`, (e as Error).message);
    }
    await sleep(rand(2000, 4500));
  }
  console.log(`\nDone. ${totalPoints} rating points across ${players?.length ?? 0} players.`);
}

main();
