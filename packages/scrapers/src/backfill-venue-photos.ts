/**
 * One-time backfill: fetch + store a Google photo for every venue that has a
 * place_id but no photo_url yet, then sync the denormalized tournaments column.
 *
 * Resumable (only touches venues with photo_url IS NULL) and rate-limited. This
 * is the script that spends the ~$1-2 of Place Photos requests — run once.
 *
 *   npx tsx packages/scrapers/src/backfill-venue-photos.ts
 *
 * Requires GOOGLE_PLACES_API_KEY + SUPABASE_SERVICE_ROLE_KEY in the env.
 */
import { supabase } from "./utils/supabase.js";
import { fetchPlaceDetailsPhotoName } from "./utils/places-client.js";
import { ensureVenuePhotoBucket, storeVenuePhoto } from "./utils/venue-photo.js";

const SLEEP_MS = 150; // ~6-7 req/s — gentle on the Places quota
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await ensureVenuePhotoBucket(supabase);

  const { data: venues, error } = await supabase
    .from("venues")
    .select("id, name, place_id")
    .is("photo_url", null)
    .not("place_id", "is", null);
  if (error) {
    console.error("[backfill-photos] query failed:", error.message);
    process.exit(1);
  }

  console.log(`[backfill-photos] ${venues?.length ?? 0} venues need a photo`);
  let stored = 0;
  let noPhoto = 0;
  let failed = 0;

  for (const v of venues ?? []) {
    try {
      const photoName = await fetchPlaceDetailsPhotoName(v.place_id as string);
      if (!photoName) {
        noPhoto++;
        console.log(`  · no photo available: ${v.name}`);
        await sleep(SLEEP_MS);
        continue;
      }
      const url = await storeVenuePhoto(supabase, v.id as string, photoName);
      if (url) {
        stored++;
        console.log(`  ✓ ${v.name}`);
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
      console.error(`  ✗ ${v.name}:`, e);
    }
    await sleep(SLEEP_MS);
  }

  const { data: synced } = await supabase.rpc("sync_tournament_venue_photos");
  console.log(
    `[backfill-photos] done — stored ${stored}, no-photo ${noPhoto}, failed ${failed}; synced ${synced ?? 0} tournament(s)`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
