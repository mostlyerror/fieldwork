/**
 * On-demand single-player pull.
 *
 * Usage (CI): set PLAYER_ID env (the players.id UUID). Force-refreshes just
 * that player — profile + full history, no staleness/queue gating. Backs the
 * manual "pull this player now" workflow and a future "refresh me" button.
 * Runs silent (no Discord) — it's a targeted action, not a batch alert.
 * Gets a little grace past the daily budget ceiling (user-facing).
 */
import { fetchPlayerMatchHistory } from "./utils/match-history.js";
import { getDuprToken, setDuprOnDemand } from "./utils/dupr-client.js";

async function main() {
  const playerId = process.env.PLAYER_ID ?? process.argv[2];
  if (!playerId) {
    console.error("[pull-player] PLAYER_ID env (or argv) required");
    process.exit(1);
  }

  setDuprOnDemand();
  if (!(await getDuprToken())) process.exit(1);
  console.log(`[pull-player] Authenticated. Pulling ${playerId}...`);

  const result = await fetchPlayerMatchHistory(playerId);
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
