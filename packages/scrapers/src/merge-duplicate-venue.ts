/**
 * One-off: merge duplicate venue rows sharing a display name. Keeps the row
 * with a photo (or the oldest), repoints tournaments, deletes the orphan(s),
 * then resyncs tournaments.venue_photo_url. Dry-run unless --apply.
 *
 *   npx tsx packages/scrapers/src/merge-duplicate-venue.ts "Casa Pickle - Space City" --apply
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY in env.
 */
import { supabase } from "./utils/supabase.js";

async function main() {
  const name = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!name) {
    console.error("Usage: merge-duplicate-venue.ts <venue name> [--apply]");
    process.exit(1);
  }

  const { data: rows, error } = await supabase
    .from("venues")
    .select("id, name, slug, place_id, dedup_key, photo_url, created_at")
    .eq("name", name)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows || rows.length < 2) {
    console.log(`Found ${rows?.length ?? 0} row(s) for "${name}" — nothing to merge.`);
    return;
  }

  // Keeper: prefer the row with a photo; tie-break oldest.
  const keeper = rows.find((r) => r.photo_url) ?? rows[0];
  const orphans = rows.filter((r) => r.id !== keeper.id);
  console.log("KEEPER:", JSON.stringify(keeper, null, 2));
  for (const o of orphans) console.log("ORPHAN:", JSON.stringify(o, null, 2));

  for (const o of orphans) {
    const { count } = await supabase
      .from("tournaments")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", o.id);
    console.log(`Orphan ${o.id} (${o.slug}) has ${count ?? 0} tournament(s) to repoint.`);
    if (!apply) continue;

    const { error: upErr } = await supabase
      .from("tournaments")
      .update({ venue_id: keeper.id })
      .eq("venue_id", o.id);
    if (upErr) throw new Error(`repoint failed: ${upErr.message}`);

    const { error: delErr } = await supabase.from("venues").delete().eq("id", o.id);
    if (delErr) throw new Error(`delete failed: ${delErr.message}`);
    console.log(`Merged ${o.id} into ${keeper.id}.`);
  }

  if (apply) {
    const { error: syncErr } = await supabase.rpc("sync_tournament_venue_photos");
    if (syncErr) throw new Error(`photo sync failed: ${syncErr.message}`);
    console.log("Resynced tournaments.venue_photo_url.");
  } else {
    console.log("Dry run — re-run with --apply to execute.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
