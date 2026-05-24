/**
 * PickleRadar Scraper Runner
 *
 * Runs all configured scrapers sequentially, logging results to the database.
 * Add new sources by importing their scrape function and adding to the sources array.
 */

import { startRun, completeRun, failRun } from "./utils/logger.js";
import { upsertTournaments } from "./utils/upsert.js";
import { scrape as scrapePickleballBrackets } from "./sources/pickleballbrackets.js";
import { scrape as scrapePickleballDen } from "./sources/pickleballden.js";
import { sendDiscordAlert } from "./utils/discord.js";
import { supabase } from "./utils/supabase.js";
import type { ScraperSource } from "./types.js";
import type { UpsertStats } from "./utils/upsert.js";

const sources: ScraperSource[] = [
  {
    name: "pickleballbrackets",
    scrape: scrapePickleballBrackets,
  },
  {
    name: "pickleball_den",
    scrape: scrapePickleballDen,
  },
  // Future sources:
  // { name: "houston_ssc", scrape: scrapeHoustonSSC },
  // { name: "sportsmonkey", scrape: scrapeSportsmonkey },
];

interface SourceResult {
  name: string;
  ok: boolean;
  found: number;
  stats?: UpsertStats;
  error?: string;
}

async function runHealthCheck(results: SourceResult[]) {
  const failures = results.filter((r) => !r.ok);
  const zeroResults = results.filter((r) => r.ok && r.found === 0);
  const warnings: string[] = [];

  if (failures.length === results.length) {
    await sendDiscordAlert({
      title: "🚨 ALL SCRAPERS FAILED",
      description: "Every source errored out. The tournament feed is not being updated.",
      color: 0xdc2626,
      fields: failures.map((f) => ({
        name: f.name,
        value: f.error ?? "Unknown error",
      })),
    });
    return;
  }

  if (zeroResults.length > 0) {
    warnings.push(
      `**Zero results** from: ${zeroResults.map((r) => r.name).join(", ")} — possible silent failure`
    );
  }

  // Check for >50% drop from last successful run per source
  for (const result of results.filter((r) => r.ok && r.found > 0)) {
    const { data: lastRun } = await supabase
      .from("scraper_runs")
      .select("tournaments_found")
      .eq("source_platform", result.name)
      .eq("status", "success")
      .gt("tournaments_found", 0)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRun && lastRun.tournaments_found > 0) {
      const dropPct = 1 - result.found / lastRun.tournaments_found;
      if (dropPct > 0.5) {
        warnings.push(
          `**${result.name}**: found ${result.found} tournaments (was ${lastRun.tournaments_found} last run, ${Math.round(dropPct * 100)}% drop)`
        );
      }
    }
  }

  if (warnings.length > 0) {
    await sendDiscordAlert({
      title: "⚠️ Scraper Health Warning",
      description: warnings.join("\n\n"),
      color: 0xeab308,
    });
  }
}

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`PickleRadar Scraper — ${new Date().toISOString()}`);
  console.log(`Running ${sources.length} source(s)`);
  console.log(`${"=".repeat(60)}\n`);

  const results: SourceResult[] = [];

  for (const source of sources) {
    const run = await startRun(source.name);

    try {
      const tournaments = await source.scrape();
      const stats = await upsertTournaments(tournaments);

      await completeRun(run, {
        tournamentsFound: tournaments.length,
        ...stats,
      });

      results.push({ name: source.name, ok: true, found: tournaments.length, stats });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await failRun(run, message);
      console.error(`[${source.name}] Source failed, continuing to next...`);
      results.push({ name: source.name, ok: false, found: 0, error: message });
    }

    console.log(""); // blank line between sources
  }

  await runHealthCheck(results);
  console.log("All sources processed.");
}

main().catch((err) => {
  console.error("Fatal error in scraper runner:", err);
  process.exit(1);
});
