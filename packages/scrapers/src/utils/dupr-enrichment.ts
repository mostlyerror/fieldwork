import { supabase } from "./supabase.js";

const DUPR_API_BASE = "https://api.dupr.gg";
const BATCH_SIZE = 50;
const STALE_DAYS = 7;

// Timing ranges (ms) — randomized to mimic human browsing patterns
const DELAY_MIN = 2000;
const DELAY_MAX = 5000;
const LONG_PAUSE_CHANCE = 0.12; // ~12% chance of a longer "distraction" pause
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

interface DuprAuthResult {
  accessToken: string;
  refreshToken: string;
}

interface DuprPlayerResult {
  id: number;
  duprId?: string;
  fullName: string;
  shortAddress?: string;
  gender?: string;
  ratings?: {
    doubles?: string;
    doublesProvisional?: boolean;
    doublesVerified?: string;
    singles?: string;
    singlesProvisional?: boolean;
    singlesVerified?: string;
  };
}

interface DuprSearchResponse {
  status: string;
  result: {
    hits: DuprPlayerResult[];
    total: number;
  };
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

async function authenticate(): Promise<DuprAuthResult | null> {
  const email = process.env.DUPR_EMAIL;
  const password = process.env.DUPR_PASSWORD;

  if (!email || !password) {
    console.error("[dupr-enrich] Missing DUPR_EMAIL or DUPR_PASSWORD env vars");
    return null;
  }

  // Brief pause before login — simulate page load
  await sleep(randBetween(1000, 3000));

  const res = await fetch(`${DUPR_API_BASE}/auth/v1.0/login/`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    console.error(`[dupr-enrich] Auth failed: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  if (data.status !== "SUCCESS") {
    console.error("[dupr-enrich] Auth response not SUCCESS:", data);
    return null;
  }

  // Post-login pause — simulate redirect/page render
  await sleep(randBetween(2000, 4000));

  return {
    accessToken: data.result.accessToken,
    refreshToken: data.result.refreshToken,
  };
}

async function searchPlayer(
  name: string,
  token: string,
  attempt = 0
): Promise<DuprPlayerResult[]> {
  const res = await fetch(`${DUPR_API_BASE}/player/v1.0/search`, {
    method: "POST",
    headers: apiHeaders(token),
    body: JSON.stringify({
      query: name,
      limit: randBetween(5, 10),
      offset: 0,
      includeUnclaimedPlayers: true,
      filter: {},
    }),
  });

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) {
      console.error(`[dupr-enrich] Rate limited ${MAX_RETRIES + 1}x for "${name}", giving up`);
      return [];
    }
    const wait = backoffDelay();
    console.warn(`[dupr-enrich] Rate limited, backing off ${(wait / 1000).toFixed(0)}s (attempt ${attempt + 1})...`);
    await sleep(wait);
    return searchPlayer(name, token, attempt + 1);
  }

  if (!res.ok) {
    console.error(`[dupr-enrich] Search failed for "${name}": ${res.status}`);
    return [];
  }

  const data = await res.json() as DuprSearchResponse;
  return data.result?.hits ?? [];
}

function normalizeCity(location: string | null): string {
  if (!location) return "";
  return location.toLowerCase().replace(/[,\s]+/g, " ").trim();
}

function normalizeGender(g: string | null | undefined): string | null {
  if (!g) return null;
  const lower = g.toLowerCase();
  if (lower === "male" || lower === "m" || lower === "men") return "M";
  if (lower === "female" || lower === "f" || lower === "women") return "F";
  return null;
}

function pickBestMatch(
  results: DuprPlayerResult[],
  playerName: string,
  playerLocation: string | null,
  playerGender: string | null,
  _listedRating: number | null
): DuprPlayerResult | null {
  if (results.length === 0) return null;

  const nameLower = playerName.toLowerCase().trim();
  const locationNorm = normalizeCity(playerLocation);
  const genderNorm = normalizeGender(playerGender);

  // Pre-filter: reject candidates with wrong gender
  const candidates = results.filter((r) => {
    if (!r.fullName) return false;
    const rGender = normalizeGender(r.gender);
    if (genderNorm && rGender && genderNorm !== rGender) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Exact name + location match is the strongest signal
  if (locationNorm) {
    const locMatch = candidates.find(
      (r) =>
        r.fullName.toLowerCase().trim() === nameLower &&
        normalizeCity(r.shortAddress ?? null).includes(locationNorm.split(" ")[0])
    );
    if (locMatch) return locMatch;
  }

  // Exact name match — but only accept if there's a single exact match
  const nameMatches = candidates.filter(
    (r) => r.fullName.toLowerCase().trim() === nameLower
  );
  if (nameMatches.length === 1) return nameMatches[0];

  // Multiple people with the same name and no location to disambiguate — skip
  return null;
}

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
  // Slight normal-ish distribution: average of two uniform randoms clusters toward center
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

interface StalePlayer {
  id: string;
  name: string;
  location: string | null;
  gender: string | null;
  dupr_doubles: number | null;
  dupr_id: string | null;
}

async function getStalePlayers(limit: number): Promise<StalePlayer[]> {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - STALE_DAYS);

  const { data, error } = await supabase
    .from("players")
    .select("id, name, location, gender, dupr_doubles, dupr_id")
    .or(`dupr_last_checked.is.null,dupr_last_checked.lt.${staleDate.toISOString()}`)
    .order("dupr_last_checked", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error("[dupr-enrich] Error fetching stale players:", error);
    return [];
  }

  return data ?? [];
}

export async function enrichDuprRatings(): Promise<{
  checked: number;
  updated: number;
  failed: number;
}> {
  console.log("[dupr-enrich] Starting DUPR enrichment...");

  const auth = await authenticate();
  if (!auth) {
    return { checked: 0, updated: 0, failed: 0 };
  }

  const players = await getStalePlayers(BATCH_SIZE);
  console.log(`[dupr-enrich] Found ${players.length} players needing DUPR refresh`);

  let updated = 0;
  let failed = 0;

  for (const player of players) {
    try {
      let match: DuprPlayerResult | null = null;

      if (player.dupr_id) {
        // Direct lookup by DUPR ID — no ambiguity
        const results = await searchPlayer(player.dupr_id, auth.accessToken);
        match = results.find((r) => r.duprId === player.dupr_id) ?? results[0] ?? null;
      } else {
        // Name-based search with fuzzy matching
        const results = await searchPlayer(player.name, auth.accessToken);
        match = pickBestMatch(results, player.name, player.location, player.gender, player.dupr_doubles);
      }

      const now = new Date().toISOString();

      if (match?.ratings?.doubles) {
        const liveRating = parseFloat(match.ratings.doubles);
        if (!isNaN(liveRating) && liveRating > 0) {
          const doublesVerified = match.ratings.doublesVerified && match.ratings.doublesVerified !== "NR"
            ? parseFloat(match.ratings.doublesVerified)
            : null;
          const singles = match.ratings.singles && match.ratings.singles !== "NR"
            ? parseFloat(match.ratings.singles)
            : null;
          const singlesVerified = match.ratings.singlesVerified && match.ratings.singlesVerified !== "NR"
            ? parseFloat(match.ratings.singlesVerified)
            : null;

          const { error } = await supabase
            .from("players")
            .update({
              dupr_doubles: liveRating,
              dupr_doubles_verified: doublesVerified,
              dupr_doubles_provisional: match.ratings.doublesProvisional ?? null,
              dupr_singles: singles,
              dupr_singles_verified: singlesVerified,
              dupr_singles_provisional: match.ratings.singlesProvisional ?? null,
              dupr_verified: !match.ratings.doublesProvisional,
              dupr_last_checked: now,
              ...(match.duprId ? { dupr_id: match.duprId } : {}),
            })
            .eq("id", player.id);

          if (error) {
            console.error(`[dupr-enrich] Update failed for "${player.name}":`, error);
            failed++;
          } else {
            const delta = player.dupr_doubles
              ? (liveRating - player.dupr_doubles).toFixed(2)
              : "new";
            const via = player.dupr_id ? "ID" : "name";
            console.log(
              `[dupr-enrich] ✓ ${player.name}: ${liveRating} (Δ ${delta}, via ${via})`
            );
            updated++;
          }
        } else {
          await supabase
            .from("players")
            .update({ dupr_last_checked: now })
            .eq("id", player.id);
        }
      } else {
        await supabase
          .from("players")
          .update({ dupr_last_checked: now })
          .eq("id", player.id);
      }
    } catch (err) {
      console.error(`[dupr-enrich] Error for "${player.name}":`, err);
      failed++;
    }

    const delay = humanDelay();
    await sleep(delay);
  }

  console.log(
    `[dupr-enrich] Done. Checked: ${players.length}, Updated: ${updated}, Failed: ${failed}`
  );

  return { checked: players.length, updated, failed };
}
