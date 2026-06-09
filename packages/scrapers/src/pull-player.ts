/**
 * On-demand single-player match-history pull.
 *
 * Usage (CI): set PLAYER_ID env (the players.id UUID). Authenticates with DUPR
 * and force-refreshes just that player — no staleness/roster gating, no queue.
 * Backs the manual "pull this player now" workflow and a future "refresh me"
 * button. Runs silent (no Discord) — it's a targeted action, not a batch alert.
 */

import { fetchPlayerMatchHistory } from "./utils/match-history.js";
import { duprFetch } from "./utils/dupr-fetch.js";

const DUPR_API_BASE = "https://api.dupr.gg";

// Same browser-like login as run-urgent-refresh's roster pass — DUPR's edge
// returns 400/FAILURE to bare datacenter POSTs; these headers get it past.
async function authenticate(): Promise<string | null> {
  if (!process.env.DUPR_EMAIL || !process.env.DUPR_PASSWORD) {
    console.error("[pull-player] Missing DUPR_EMAIL / DUPR_PASSWORD");
    return null;
  }
  const res = await duprFetch(`${DUPR_API_BASE}/auth/v1.0/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Origin: "https://dashboard.dupr.com",
      Referer: "https://dashboard.dupr.com/",
    },
    body: JSON.stringify({ email: process.env.DUPR_EMAIL, password: process.env.DUPR_PASSWORD }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== "SUCCESS" || !data?.result?.accessToken) {
    console.error(`[pull-player] DUPR login failed: HTTP ${res.status}, status=${data?.status ?? "?"}`);
    return null;
  }
  return data.result.accessToken as string;
}

async function main() {
  const playerId = process.env.PLAYER_ID ?? process.argv[2];
  if (!playerId) {
    console.error("[pull-player] PLAYER_ID env (or argv) required");
    process.exit(1);
  }

  const token = await authenticate();
  if (!token) process.exit(1);
  console.log(`[pull-player] Authenticated. Pulling ${playerId}...`);

  const result = await fetchPlayerMatchHistory(token, playerId);
  if (!result) {
    console.error("[pull-player] No data (player missing or no dupr_id).");
    process.exit(1);
  }
  console.log(`[pull-player] Done: ${result.matchesInserted} matches upserted for ${result.summary.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pull-player] Fatal:", err);
    process.exit(1);
  });
