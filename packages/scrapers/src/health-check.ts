/**
 * Standalone scraper staleness monitor.
 *
 * Runs on a separate cron schedule from the scrapers themselves.
 * Alerts if no successful scrape has completed in the last 18 hours,
 * meaning both the 9am and 9pm runs likely failed or never started.
 */

import { supabase } from "./utils/supabase.js";
import { sendDiscordAlert } from "./utils/discord.js";
import { posthog, SCRAPER_ID, shutdownPostHog } from "./utils/posthog.js";

const STALE_THRESHOLD_HOURS = 18;

async function main() {
  const cutoff = new Date(
    Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: recentRuns, error } = await supabase
    .from("scraper_runs")
    .select("source_platform, status, completed_at, tournaments_found")
    .gte("completed_at", cutoff)
    .eq("status", "success")
    .order("completed_at", { ascending: false });

  if (error) {
    console.error("[health-check] Error querying scraper_runs:", error);
    posthog?.captureException(new Error(error.message), SCRAPER_ID, { context: "health_check_query" });
    await sendDiscordAlert({
      title: "🚨 Health Check Failed",
      description: `Could not query scraper_runs: ${error.message}`,
      color: 0xdc2626,
    });
    await shutdownPostHog();
    process.exit(1);
  }

  if (!recentRuns || recentRuns.length === 0) {
    posthog?.capture({
      distinctId: SCRAPER_ID,
      event: "health_check_stale",
      properties: { stale_threshold_hours: STALE_THRESHOLD_HOURS },
    });
    await sendDiscordAlert({
      title: "🚨 Scraper Data is STALE",
      description: `No successful scraper run in the last ${STALE_THRESHOLD_HOURS} hours. The tournament feed may be outdated.`,
      color: 0xdc2626,
      fields: [
        {
          name: "Action Required",
          value:
            "Check GitHub Actions for workflow failures, or trigger a manual run.",
        },
      ],
    });
    console.error(
      `[health-check] STALE: No successful runs in ${STALE_THRESHOLD_HOURS}h`
    );
    await shutdownPostHog();
    process.exit(1);
  }

  const sourcesWithRuns = [
    ...new Set(recentRuns.map((r) => r.source_platform)),
  ];

  console.log(
    `[health-check] OK: ${recentRuns.length} successful run(s) in last ${STALE_THRESHOLD_HOURS}h from [${sourcesWithRuns.join(", ")}]`
  );
  await shutdownPostHog();
}

main().catch(async (err) => {
  console.error("Fatal error in health check:", err);
  posthog?.captureException(err, SCRAPER_ID);
  await shutdownPostHog();
  process.exit(1);
});
