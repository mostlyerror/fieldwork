/**
 * Shared, metered DUPR client — the single chokepoint for ALL DUPR API access.
 * Design: docs/dupr-metered-layer.md
 *
 * What lives here (and ONLY here — callers never touch duprFetch/headers/sleeps):
 *  - getDuprToken(): reads the stored session (dupr_session table) first, then
 *    tries a refresh, and only logs in when neither works. Memoized per
 *    process. Logins always use the browser header set (Origin/Referer/UA);
 *    the bare {email,password} POST fails from CI ("Bad request format").
 *  - duprSearch / duprHistoryPage / duprProfile: every DUPR endpoint as a
 *    metered primitive. New endpoints get added here, never inline.
 *  - Metering inside meteredFetch:
 *      · global daily budget via take_dupr_budget RPC (one counter row per UTC
 *        day) — DUPR_DAILY_CEILING (default 1500) is the "don't get cut off"
 *        ceiling shared by every job, cron or manual. Discord warning at 80%.
 *      · human pacing (2–5s, 12% long pause; quicker for pagination clicks)
 *      · ONE User-Agent per process — real browsers don't rotate UA mid-session
 *      · 429 backoff (25–90s, 2 retries) + a circuit breaker: 3 consecutive
 *        rate-limit/block give-ups aborts the whole run instead of poking on.
 */
import { duprFetch } from "./dupr-fetch.js";
import { supabase } from "./supabase.js";
import { sendDiscordAlert } from "./discord.js";
import { type DuprSession, isUsableToken, redactAuthBody, sessionFromAuthBody } from "./dupr-token.js";

const API = "https://api.dupr.gg";

// ---------------------------------------------------------------------------
// Errors — batch loops catch these to end a run gracefully (not per-player).
// ---------------------------------------------------------------------------

/** Global daily request ceiling reached — stop pulling, finish cleanly. */
export class DuprBudgetExhausted extends Error {
  constructor(total: number, ceiling: number) {
    super(`DUPR daily budget exhausted (${total}/${ceiling})`);
  }
}

/** Too many consecutive rate-limits/blocks — abort the run, don't keep poking. */
export class DuprCircuitOpen extends Error {
  constructor() {
    super("DUPR circuit open: repeated rate-limiting — aborting this run");
  }
}

/** Login failed (already alerted to Discord by the client). */
export class DuprAuthFailed extends Error {
  constructor() {
    super("DUPR auth failed");
  }
}

// ---------------------------------------------------------------------------
// Pacing — one implementation, session-stable UA
// ---------------------------------------------------------------------------

const DELAY_MIN = 2000;
const DELAY_MAX = 5000;
const LONG_PAUSE_CHANCE = 0.12; // ~12% chance of a longer "distraction" pause
const LONG_PAUSE_MIN = 8000;
const LONG_PAUSE_MAX = 18000;
const PAGE_MIN = 800; // pagination clicks come quicker than fresh actions
const PAGE_MAX = 1800;
const BACKOFF_MIN = 25_000;
const BACKOFF_MAX = 90_000;
const MAX_RETRIES = 2;
const CIRCUIT_LIMIT = 3;

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
];
// One UA for the whole process — rotating per request is a bot tell, not camouflage.
const SESSION_UA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randBetween = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));

type Pace = "normal" | "page";

function paceDelay(pace: Pace): number {
  if (pace === "page") return randBetween(PAGE_MIN, PAGE_MAX);
  if (Math.random() < LONG_PAUSE_CHANCE) return randBetween(LONG_PAUSE_MIN, LONG_PAUSE_MAX);
  // Average of two uniforms clusters toward the center — slightly normal-ish.
  return Math.floor((randBetween(DELAY_MIN, DELAY_MAX) + randBetween(DELAY_MIN, DELAY_MAX)) / 2);
}

function headers(token?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": SESSION_UA,
    Origin: "https://dashboard.dupr.com",
    Referer: "https://dashboard.dupr.com/",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ---------------------------------------------------------------------------
// Global daily budget
// ---------------------------------------------------------------------------

const DAILY_CEILING = parseInt(process.env.DUPR_DAILY_CEILING ?? "1500", 10);
const WARN_AT = Math.floor(DAILY_CEILING * 0.8);
// On-demand pulls (a user-facing "pull this player now") get a little grace past
// the soft ceiling — they're tiny and shouldn't be starved by batch jobs.
const ON_DEMAND_GRACE = 50;

let onDemand = false;
/** Mark this process as an on-demand pull (pull-player) — small ceiling grace. */
export function setDuprOnDemand(): void {
  onDemand = true;
}

let budgetRpcWarned = false;

async function takeBudget(): Promise<void> {
  const { data, error } = await supabase.rpc("take_dupr_budget", { n: 1 });
  if (error) {
    // Infra error ≠ over budget. Fail open so a budget-table hiccup can't
    // silently kill data freshness — but say so once.
    if (!budgetRpcWarned) {
      budgetRpcWarned = true;
      console.warn("[dupr-client] take_dupr_budget RPC failed — budget NOT enforced this run:", error.message);
    }
    return;
  }
  const total = data as number;
  const ceiling = onDemand ? DAILY_CEILING + ON_DEMAND_GRACE : DAILY_CEILING;
  if (total > ceiling) throw new DuprBudgetExhausted(total, ceiling);
  // Fire the warning exactly once: on the request that crosses the threshold.
  if (total === WARN_AT || (total > WARN_AT && total - 1 < WARN_AT)) {
    console.warn(`[dupr-client] DUPR budget at ${total}/${DAILY_CEILING} (80% warning)`);
    await sendDiscordAlert({
      title: "⚠️ DUPR request budget at 80%",
      description: `${total}/${DAILY_CEILING} requests used today. Batch runs stop at the ceiling.`,
    }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Metered fetch — budget → pace → request → backoff/circuit
// ---------------------------------------------------------------------------

let consecutiveBlocks = 0;
let circuitAlerted = false;
let authRejectedAlerted = false;

async function tripCircuitIfNeeded(): Promise<void> {
  consecutiveBlocks += 1;
  if (consecutiveBlocks < CIRCUIT_LIMIT) return;
  if (!circuitAlerted) {
    circuitAlerted = true;
    await sendDiscordAlert({
      title: "🚨 DUPR circuit breaker tripped",
      description: `${CIRCUIT_LIMIT} consecutive rate-limits/blocks — aborting this run instead of continuing to poke DUPR.`,
    }).catch(() => {});
  }
  throw new DuprCircuitOpen();
}

async function meteredFetch(
  path: string,
  init: RequestInit,
  pace: Pace = "normal",
): Promise<Response | null> {
  for (let attempt = 0; ; attempt++) {
    await takeBudget();
    await sleep(paceDelay(pace));
    const res = await duprFetch(`${API}${path}`, init);

    if (res.status === 429) {
      if (attempt >= MAX_RETRIES) {
        console.error(`[dupr-client] Rate limited ${MAX_RETRIES + 1}x on ${path}, giving up`);
        await tripCircuitIfNeeded();
        return null; // circuit not open yet — caller skips this one item
      }
      const wait = randBetween(BACKOFF_MIN, BACKOFF_MAX);
      console.warn(`[dupr-client] Rate limited, backing off ${(wait / 1000).toFixed(0)}s (attempt ${attempt + 1})...`);
      await sleep(wait);
      continue;
    }

    if (res.status === 401 && !path.startsWith("/auth/")) {
      // The stored token died early (revoked, or expiry unknown). Drop it so the
      // next run refreshes or logs in, and end this run.
      console.error(`[dupr-client] 401 (token rejected) on ${path}`);
      if (!authRejectedAlerted) {
        authRejectedAlerted = true;
        await clearStoredAccessToken();
        await sendDiscordAlert({
          title: "⚠️ DUPR token rejected",
          description: "DUPR answered 401 to the stored token. Cleared it; the next run will try to refresh or log in.",
        }).catch(() => {});
      }
      throw new DuprAuthFailed();
    }

    if (res.status === 403) {
      // Edge block — not transient; don't retry, but count toward the circuit.
      console.error(`[dupr-client] 403 (blocked) on ${path}`);
      await tripCircuitIfNeeded();
      return null;
    }

    consecutiveBlocks = 0;
    return res;
  }
}

// ---------------------------------------------------------------------------
// Auth — stored session first, login only when there is no usable token
// ---------------------------------------------------------------------------
//
// Since 2026-09-08 a fresh login gets HTTP 428 and DUPR emails a sign-in code,
// so logging in per process can't work. Ben verifies once by hand
// (`npm run dupr:login`), which saves the session to the dupr_session table
// (service_role only). Every job reads it from there.

const SESSION_ROW = 1; // dupr_session holds exactly one row

let tokenPromise: Promise<string | null> | null = null;

async function loadSession(): Promise<DuprSession | null> {
  const { data, error } = await supabase
    .from("dupr_session")
    .select("access_token, refresh_token, expires_at")
    .eq("id", SESSION_ROW)
    .maybeSingle();
  if (error) {
    console.warn("[dupr-client] Could not read dupr_session:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
  };
}

/** Save a session so later jobs reuse it instead of logging in. */
export async function saveDuprSession(session: DuprSession): Promise<void> {
  const { error } = await supabase.from("dupr_session").upsert({
    id: SESSION_ROW,
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expires_at: session.expiresAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not save dupr_session: ${error.message}`);
}

/** DUPR said 401 to the stored token. Drop it so the next run refreshes or logs in. */
async function clearStoredAccessToken(): Promise<void> {
  const { error } = await supabase
    .from("dupr_session")
    .update({ access_token: null, expires_at: null, updated_at: new Date().toISOString() })
    .eq("id", SESSION_ROW);
  if (error) console.warn("[dupr-client] Could not clear dupr_session token:", error.message);
}

/**
 * Trade the refresh token for a new access token.
 * GUESS: endpoint and header name. The web dashboard is believed to call
 * GET /auth/v1.0/refresh/ with the refresh token in `x-refresh-token`. Ben has
 * to check this against a real session. If it's wrong this just returns null
 * and we fall through to a normal login.
 */
async function refreshSession(refreshToken: string): Promise<DuprSession | null> {
  const res = await meteredFetch("/auth/v1.0/refresh/", {
    method: "GET",
    headers: { ...headers(), "x-refresh-token": refreshToken },
  });
  const data = res ? await res.json().catch(() => null) : null;
  const session = sessionFromAuthBody(data);
  if (!session) {
    console.warn(`[dupr-client] DUPR token refresh failed (HTTP ${res?.status ?? "?"}, status=${data?.status ?? "?"})`);
    return null;
  }
  // GUESS: if refresh doesn't hand back a new refresh token, keep the old one.
  return { ...session, refreshToken: session.refreshToken ?? refreshToken };
}

async function postLogin(): Promise<{ res: Response | null; data: any }> {
  await sleep(randBetween(1000, 3000)); // simulate the login page loading
  const res = await meteredFetch("/auth/v1.0/login/", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email: process.env.DUPR_EMAIL, password: process.env.DUPR_PASSWORD }),
  });
  const data = res ? await res.json().catch(() => null) : null;
  return { res, data };
}

async function login(): Promise<DuprSession | null> {
  if (!process.env.DUPR_EMAIL || !process.env.DUPR_PASSWORD) {
    console.error("[dupr-client] Missing DUPR_EMAIL / DUPR_PASSWORD");
    return null;
  }
  const { res, data } = await postLogin();
  const session = sessionFromAuthBody(data);
  if (!res?.ok || !session) {
    const detail = `HTTP ${res?.status ?? "?"}, status=${data?.status ?? "?"}`;
    console.error(`[dupr-client] DUPR login failed (${detail})`);
    const why =
      res?.status === 428
        ? "DUPR wants the emailed sign-in code. Run `npm run dupr:login` in packages/scrapers once to save a fresh session."
        : "Usually a stale DUPR_EMAIL/DUPR_PASSWORD secret.";
    await sendDiscordAlert({
      title: "⚠️ DUPR login failed",
      description: `DUPR returned ${detail}. ${why} No DUPR data pulled this run.`,
    }).catch(() => {});
    return null;
  }
  return session;
}

async function resolveToken(): Promise<string | null> {
  const stored = await loadSession();
  if (isUsableToken(stored)) {
    console.log("[dupr-client] Using stored DUPR session");
    return stored!.accessToken;
  }
  if (stored?.refreshToken) {
    const refreshed = await refreshSession(stored.refreshToken);
    if (refreshed) {
      await saveDuprSession(refreshed).catch((e) => console.warn("[dupr-client]", e.message));
      console.log("[dupr-client] Refreshed stored DUPR session");
      return refreshed.accessToken;
    }
  }
  const session = await login();
  if (!session) return null;
  await saveDuprSession(session).catch((e) => console.warn("[dupr-client]", e.message));
  return session.accessToken;
}

/** Get a DUPR token once per process (memoized). Null = failed (alerted). */
export function getDuprToken(): Promise<string | null> {
  // SKIP_DUPR=1 turns DUPR off without touching callers. They already treat a
  // null token as "no DUPR this run". No login means no emailed sign-in code.
  if (process.env.SKIP_DUPR === "1") {
    console.warn("[dupr-client] SKIP_DUPR=1, not logging in to DUPR");
    return Promise.resolve(null);
  }
  if (!tokenPromise) tokenPromise = resolveToken();
  return tokenPromise;
}

/**
 * The one-time manual login behind `npm run dupr:login`. Logs in; if DUPR
 * answers 428, asks for the emailed code and sends it back. Returns the new
 * session (the caller saves it) or null.
 *
 * GUESSES, all unverified because the agent that wrote this could not reach
 * DUPR. Ben checks them against the real 428 body, which this prints in full
 * (tokens redacted):
 *  - The 428 body carries some id for this login attempt. We pass along every
 *    string field in `result` (e.g. a session or challenge id) untouched.
 *  - The code goes to POST DUPR_VERIFY_PATH (default /auth/v1.0/login/verify/)
 *    as { email, code, ...those fields }.
 *  - A good code gets back the same shape as a normal login.
 */
export async function interactiveDuprLogin(askCode: () => Promise<string>): Promise<DuprSession | null> {
  if (!process.env.DUPR_EMAIL || !process.env.DUPR_PASSWORD) {
    console.error("[dupr-login] Missing DUPR_EMAIL / DUPR_PASSWORD");
    return null;
  }
  const { res, data } = await postLogin();
  console.log(`[dupr-login] Login answered HTTP ${res?.status ?? "?"}:`);
  console.log(JSON.stringify(redactAuthBody(data), null, 2));

  const direct = sessionFromAuthBody(data);
  if (res?.ok && direct) return direct; // no code needed this time
  if (res?.status !== 428) return null;

  const challenge: Record<string, string> = {};
  for (const [k, v] of Object.entries((data?.result ?? {}) as Record<string, unknown>)) {
    if (typeof v === "string") challenge[k] = v;
  }
  const code = (await askCode()).trim();
  if (!code) return null;

  const path = process.env.DUPR_VERIFY_PATH?.trim() || "/auth/v1.0/login/verify/";
  const vres = await meteredFetch(path, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email: process.env.DUPR_EMAIL, code, ...challenge }),
  });
  const vdata = vres ? await vres.json().catch(() => null) : null;
  console.log(`[dupr-login] Verify (${path}) answered HTTP ${vres?.status ?? "?"}:`);
  console.log(JSON.stringify(redactAuthBody(vdata), null, 2));
  return sessionFromAuthBody(vdata);
}

async function requireToken(): Promise<string> {
  const token = await getDuprToken();
  if (!token) throw new DuprAuthFailed();
  return token;
}

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

export interface DuprRatings {
  doubles?: string;
  doublesProvisional?: boolean;
  doublesVerified?: string;
  singles?: string;
  singlesProvisional?: boolean;
  singlesVerified?: string;
}

export interface DuprSearchHit {
  id: number; // DUPR's internal numeric id — cache it (players.dupr_numeric_id)
  duprId?: string;
  fullName: string;
  shortAddress?: string;
  gender?: string;
  ratings?: DuprRatings;
}

export interface DuprTeamPlayer {
  id: number;
  fullName: string;
  duprId?: string;
  postMatchRating?: { singles: number | null; doubles: number | null };
}

export interface DuprTeam {
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

export interface DuprMatchHit {
  matchId: number;
  eventDate: string;
  eventFormat: string;
  league?: string;
  venue?: string;
  teams: DuprTeam[];
}

/** Parse DUPR's stringly-typed ratings block into numbers (null = NR/absent). */
export function parseRatings(ratings: DuprRatings | undefined) {
  const num = (s?: string) => {
    if (!s || s === "NR") return null;
    const n = parseFloat(s);
    return isNaN(n) || n <= 0 ? null : n;
  };
  return {
    doubles: num(ratings?.doubles),
    doublesVerified: num(ratings?.doublesVerified),
    doublesProvisional: ratings?.doublesProvisional ?? null,
    singles: num(ratings?.singles),
    singlesVerified: num(ratings?.singlesVerified),
    singlesProvisional: ratings?.singlesProvisional ?? null,
  };
}

// ---------------------------------------------------------------------------
// Endpoint primitives
// ---------------------------------------------------------------------------

/** POST /player/v1.0/search — name or DUPR-id lookup. Empty array on failure. */
export async function duprSearch(query: string, limit?: number): Promise<DuprSearchHit[]> {
  const token = await requireToken();
  const res = await meteredFetch("/player/v1.0/search", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      query,
      limit: limit ?? randBetween(5, 10), // humans don't request page sizes of exactly 5 every time
      offset: 0,
      includeUnclaimedPlayers: true,
      filter: {},
    }),
  });
  if (!res?.ok) {
    if (res) console.error(`[dupr-client] Search failed for "${query}": ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { status: string; result?: { hits?: DuprSearchHit[] } };
  return data.result?.hits ?? [];
}

export const HISTORY_PAGE = 25; // DUPR caps the history limit at 25 per request

/** POST /player/v1.0/{id}/history — one page of a player's match history. */
export async function duprHistoryPage(
  numericId: number,
  offset: number,
): Promise<{ hits: DuprMatchHit[]; total: number }> {
  const token = await requireToken();
  const res = await meteredFetch(
    `/player/v1.0/${numericId}/history`,
    {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        filters: {},
        sort: { order: "DESC", parameter: "MATCH_DATE" },
        limit: HISTORY_PAGE,
        offset,
      }),
    },
    offset === 0 ? "normal" : "page", // later pages are pagination clicks
  );
  if (!res?.ok) {
    if (res) {
      const body = await res.text().catch(() => "");
      console.error(`[dupr-client] History fetch failed for player ${numericId}: ${res.status} ${body.slice(0, 200)}`);
    }
    return { hits: [], total: 0 };
  }
  const data = (await res.json()) as { status: string; result?: { hits?: DuprMatchHit[]; total?: number } };
  return { hits: data.result?.hits ?? [], total: data.result?.total ?? 0 };
}

/**
 * GET /player/v1.0/{id} — a player's profile, including the per-format
 * verified/provisional rating flags the search response doesn't carry reliably.
 * Null on failure (callers treat the profile as best-effort).
 */
export async function duprProfile(numericId: number): Promise<DuprSearchHit | null> {
  const token = await requireToken();
  const res = await meteredFetch(`/player/v1.0/${numericId}`, {
    method: "GET",
    headers: headers(token),
  });
  if (!res?.ok) {
    if (res) console.error(`[dupr-client] Profile fetch failed for player ${numericId}: ${res.status}`);
    return null;
  }
  const data = (await res.json()) as { status: string; result?: DuprSearchHit };
  return data.result ?? null;
}
