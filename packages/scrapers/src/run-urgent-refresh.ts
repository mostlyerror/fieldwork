/**
 * Urgent Refresh CLI
 *
 * Lightweight re-scrape for tournaments closing or starting soon.
 * Runs hourly via GitHub Actions; can also be invoked manually.
 */

import { runUrgentRefresh } from "./urgent-refresh.js";

runUrgentRefresh()
  .then((r) => {
    console.log("[urgent-refresh] Result:", JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error("[urgent-refresh] Failed:", err);
    process.exit(1);
  });
