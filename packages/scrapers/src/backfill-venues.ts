// packages/scrapers/src/backfill-venues.ts
// One-time, resumable, rate-limited backfill: resolve existing tournament
// locations to venues and link them. Re-runnable — only touches rows where
// venue_id IS NULL. Run: npx tsx packages/scrapers/src/backfill-venues.ts
import { supabase } from "./utils/supabase.js";
import { resolveVenue } from "./utils/resolve-venue.js";

const SLEEP_MS = 120; // ~8 req/s ceiling on Places calls

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // Distinct unlinked locations.
  const { data: rows, error } = await supabase
    .from("tournaments")
    .select("location_name, location_address, latitude, longitude")
    .is("venue_id", null);

  if (error) {
    console.error("[backfill] failed to load tournaments:", error);
    process.exit(1);
  }

  // Dedupe locations in-app by the same tuple resolveVenue keys on.
  const seen = new Map<string, { name: string; address: string | null; lat: number | null; lng: number | null }>();
  for (const r of rows ?? []) {
    const key = `${r.location_name}|${r.latitude ?? "na"}|${r.longitude ?? "na"}`;
    if (!seen.has(key)) {
      seen.set(key, {
        name: r.location_name,
        address: r.location_address ?? null,
        lat: r.latitude ?? null,
        lng: r.longitude ?? null,
      });
    }
  }

  console.log(`[backfill] ${seen.size} distinct unlinked locations`);
  let processed = 0;
  let linked = 0;

  for (const loc of seen.values()) {
    const venueId = await resolveVenue({
      name: loc.name,
      address: loc.address,
      latitude: loc.lat,
      longitude: loc.lng,
    });
    processed++;

    if (venueId) {
      // Link all unlinked tournaments at this exact location tuple.
      let q = supabase.from("tournaments").update({ venue_id: venueId })
        .is("venue_id", null)
        .eq("location_name", loc.name);
      q = loc.lat == null ? q.is("latitude", null) : q.eq("latitude", loc.lat);
      q = loc.lng == null ? q.is("longitude", null) : q.eq("longitude", loc.lng);
      const { data: updated, error: linkErr } = await q.select("id");
      if (linkErr) console.error(`[backfill] link failed for "${loc.name}":`, linkErr);
      else linked += updated?.length ?? 0;
    }

    if (processed % 10 === 0) {
      console.log(`[backfill] processed ${processed}/${seen.size}, linked ${linked} tournaments`);
    }
    await sleep(SLEEP_MS);
  }

  console.log(`[backfill] DONE — ${processed} locations, ${linked} tournaments linked`);
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
