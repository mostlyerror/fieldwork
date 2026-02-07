/**
 * PickleUp Scraper Runner
 *
 * Runs all configured scrapers sequentially, logging results to the database.
 * Add new sources by importing their scrape function and adding to the sources array.
 */

import { startRun, completeRun, failRun } from "./utils/logger.js";
import { upsertTournaments } from "./utils/upsert.js";
import { scrape as scrapePickleballBrackets } from "./sources/pickleballbrackets.js";
import { scrape as scrapePickleballDen } from "./sources/pickleballden.js";
import type { ScraperSource } from "./types.js";

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

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`PickleUp Scraper — ${new Date().toISOString()}`);
  console.log(`Running ${sources.length} source(s)`);
  console.log(`${"=".repeat(60)}\n`);

  for (const source of sources) {
    const run = await startRun(source.name);

    try {
      const tournaments = await source.scrape();
      const stats = await upsertTournaments(tournaments);

      await completeRun(run, {
        tournamentsFound: tournaments.length,
        ...stats,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await failRun(run, message);
      console.error(`[${source.name}] Source failed, continuing to next...`);
    }

    console.log(""); // blank line between sources
  }

  console.log("All sources processed.");
}

main().catch((err) => {
  console.error("Fatal error in scraper runner:", err);
  process.exit(1);
});
