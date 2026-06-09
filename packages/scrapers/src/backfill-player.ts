/**
 * Targeted backfill for a single player by DUPR id: full pull (profile +
 * matches + rating history), same code path as pull-player / the queue.
 *
 *   npx tsx packages/scrapers/src/backfill-player.ts <DUPR_ID>
 *
 * Requires DUPR_EMAIL, DUPR_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { supabase } from "./utils/supabase.js";
import { fetchPlayerMatchHistory } from "./utils/match-history.js";
import { getDuprToken, setDuprOnDemand } from "./utils/dupr-client.js";

async function main() {
  const duprId = process.argv[2];
  if (!duprId) {
    console.error("usage: backfill-player.ts <DUPR_ID>");
    process.exit(1);
  }

  const { data: me } = await supabase.from("players").select("id, name").eq("dupr_id", duprId).maybeSingle();
  if (!me) {
    console.error(`No player with dupr_id ${duprId}`);
    process.exit(1);
  }
  console.log(`Player: ${me.name} (${me.id})`);

  setDuprOnDemand();
  if (!(await getDuprToken())) process.exit(1);

  const result = await fetchPlayerMatchHistory(me.id as string);
  if (!result) {
    console.error("No data pulled.");
    process.exit(1);
  }
  console.log(`Done: ${result.matchesInserted} matches upserted for ${result.summary.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
