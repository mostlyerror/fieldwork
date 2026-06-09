/**
 * Twice-daily DUPR pull — drains the shared pull queue (roster-priority, then
 * staleness) with a bigger cap than the hourly pass. Auth, pacing, retries,
 * and the global daily budget all live in utils/dupr-client.ts.
 */
import { pullQueuedPlayers } from "./utils/match-history.js";
import { getDuprToken } from "./utils/dupr-client.js";

const BATCH_SIZE = 30;

async function main() {
  console.log("Match History Enrichment — standalone run");
  console.log("=".repeat(40));

  if (!(await getDuprToken())) {
    console.error("Authentication failed. Exiting.");
    process.exit(1);
  }
  console.log("[enrich-matches] Authenticated with DUPR");

  const result = await pullQueuedPlayers(BATCH_SIZE);

  console.log("\nSummary:");
  console.log(`  Players checked:    ${result.playersChecked}`);
  console.log(`  Matches upserted:   ${result.matchesInserted}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
