import { enrichDuprRatings } from "./utils/dupr-enrichment.js";

async function main() {
  console.log("DUPR Enrichment — standalone run");
  console.log("=".repeat(40));

  const result = await enrichDuprRatings();

  console.log("\nSummary:");
  console.log(`  Checked:  ${result.checked}`);
  console.log(`  Updated:  ${result.updated}`);
  console.log(`  Failed:   ${result.failed}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
