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
import { startRun, completeRun, failRun } from "./utils/logger.js";

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
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[urgent-refresh] Failed:", err);
    await failRun(run, message);
    process.exit(1);
  }
}

main();
