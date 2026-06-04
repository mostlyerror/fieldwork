/**
 * Urgent Refresh CLI
 *
 * Lightweight re-scrape for tournaments closing or starting soon.
 * Runs hourly via GitHub Actions; can also be invoked manually.
 *
 * Logs each run to scraper_runs (source_platform "urgent_refresh") so it shows up
 * on /admin/scraping with its own health lane. Success is logged silently —
 * runUrgentRefresh sends its own ♻️ summary, so completeRun shouldn't double-post.
 * A hard failure goes through failRun, which fires the 🚨 alert the refresh
 * otherwise never sent (the observability gap this closes).
 */

import { runUrgentRefresh } from "./urgent-refresh.js";
import { fetchNewPlayerMatchHistory } from "./utils/match-history.js";
import { startRun, completeRun, failRun } from "./utils/logger.js";

// Metered: at most this many brand-new players get their DUPR history pulled
// per hourly run, so a freshly-added player lights up within ~an hour without
// bursting the DUPR API. Best-effort — never fails the refresh.
const NEW_PLAYER_CAP = 5;

async function newPlayerHistoryPass(): Promise<void> {
  if (!process.env.DUPR_EMAIL || !process.env.DUPR_PASSWORD) return;
  try {
    const res = await fetch("https://api.dupr.gg/auth/v1.0/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: process.env.DUPR_EMAIL, password: process.env.DUPR_PASSWORD }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.status !== "SUCCESS") return;
    const r = await fetchNewPlayerMatchHistory(data.result.accessToken, NEW_PLAYER_CAP);
    if (r.playersChecked > 0) {
      console.log(`[urgent-refresh] new-player history: ${r.playersChecked} player(s), ${r.matchesInserted} matches`);
    }
  } catch (err) {
    console.error("[urgent-refresh] new-player history pass failed (non-fatal):", err);
  }
}

async function main() {
  const run = await startRun("urgent_refresh");
  try {
    const r = await runUrgentRefresh();
    console.log("[urgent-refresh] Result:", JSON.stringify(r, null, 2));
    await completeRun(
      run,
      {
        tournamentsFound: r.tournamentsChecked,
        tournamentsNew: 0, // urgent refresh never discovers new tournaments
        tournamentsUpdated: r.eventsUpdated,
        tournamentsDeduplicated: 0,
      },
      { silent: true },
    );
    // Metered new-player history pass — gentle on DUPR, best-effort.
    await newPlayerHistoryPass();
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[urgent-refresh] Failed:", err);
    await failRun(run, message);
    process.exit(1);
  }
}

main();
