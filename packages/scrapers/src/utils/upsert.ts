import { supabase } from "./supabase.js";
import { findCanonicalMatch, addTournamentSource } from "./dedup.js";
import type { ScrapedTournament } from "../types.js";

export interface UpsertStats {
  tournamentsNew: number;
  tournamentsUpdated: number;
  tournamentsDeduplicated: number;
  newTournamentIds: string[];
}

/**
 * Upsert a batch of scraped tournaments into the database.
 *
 * Logic per tournament:
 * 1. Same-source check: WHERE source_platform = ? AND source_url = ?
 *    - Found + same hash  → SKIP
 *    - Found + diff hash  → UPDATE
 *    - Not found           → continue to step 2
 * 2. Cross-platform check: find_nearby_tournament(date, lat, lng, 100m)
 *    - Found canonical     → INSERT as duplicate, add source to canonical
 *    - Not found           → INSERT as new canonical, add source
 */
export async function upsertTournaments(
  tournaments: ScrapedTournament[]
): Promise<UpsertStats> {
  let tournamentsNew = 0;
  let tournamentsUpdated = 0;
  let tournamentsDeduplicated = 0;
  const newTournamentIds: string[] = [];

  for (const t of tournaments) {
    try {
      // Step 1: Check if tournament already exists by source
      const { data: existing, error: fetchError } = await supabase
        .from("tournaments")
        .select("id, source_hash")
        .eq("source_platform", t.sourcePlatform)
        .eq("source_url", t.sourceUrl)
        .maybeSingle();

      if (fetchError) {
        console.error(
          `[upsert] Error checking existing tournament "${t.name}":`,
          fetchError
        );
        continue;
      }

      const row = {
        name: t.name,
        date_start: t.dateStart,
        date_end: t.dateEnd || null,
        location_name: t.locationName,
        location_address: t.locationAddress || null,
        latitude: t.latitude || null,
        longitude: t.longitude || null,
        skill_levels: t.skillLevels.length > 0 ? t.skillLevels : null,
        format: t.format || null,
        entry_fee: t.entryFee || null,
        registration_url: t.registrationUrl,
        registration_status: t.registrationStatus || "open",
        source_platform: t.sourcePlatform,
        source_url: t.sourceUrl,
        source_hash: t.rawPageHash,
        description: t.description || null,
      };

      if (existing) {
        if (existing.source_hash !== t.rawPageHash) {
          // Existing tournament with changed content — update
          const { error: updateError } = await supabase
            .from("tournaments")
            .update(row)
            .eq("id", existing.id);

          if (updateError) {
            console.error(
              `[upsert] Error updating "${t.name}":`,
              updateError
            );
          } else {
            tournamentsUpdated++;
            console.log(`[upsert] UPDATED: "${t.name}" (${t.dateStart})`);
          }
        } else {
          // Unchanged — skip
          console.log(`[upsert] UNCHANGED: "${t.name}" (${t.dateStart})`);
        }
        continue;
      }

      // Step 2: Cross-platform dedup check (only if we have GPS)
      if (t.latitude && t.longitude) {
        const canonical = await findCanonicalMatch(
          t.dateStart,
          t.latitude,
          t.longitude
        );

        if (canonical) {
          // Insert as duplicate pointing to canonical
          const { error: insertError } = await supabase
            .from("tournaments")
            .insert({
              ...row,
              status: "duplicate",
              canonical_id: canonical.id,
            });

          if (insertError) {
            console.error(
              `[upsert] Error inserting duplicate "${t.name}":`,
              insertError
            );
          } else {
            tournamentsDeduplicated++;
            console.log(
              `[upsert] DEDUP: "${t.name}" → canonical "${canonical.name}"`
            );
            // Add this platform's source to the canonical tournament
            await addTournamentSource(
              canonical.id,
              t.sourcePlatform,
              t.sourceUrl,
              t.registrationUrl
            );
          }
          continue;
        }
      }

      // No existing match — insert as new canonical
      const { data: inserted, error: insertError } = await supabase
        .from("tournaments")
        .insert(row)
        .select("id")
        .single();

      if (insertError) {
        console.error(
          `[upsert] Error inserting "${t.name}":`,
          insertError
        );
      } else {
        tournamentsNew++;
        newTournamentIds.push(inserted.id);
        console.log(`[upsert] NEW: "${t.name}" (${t.dateStart})`);
        // Record this source for the new canonical tournament
        await addTournamentSource(
          inserted.id,
          t.sourcePlatform,
          t.sourceUrl,
          t.registrationUrl
        );
      }
    } catch (err) {
      console.error(`[upsert] Unexpected error for "${t.name}":`, err);
    }
  }

  return { tournamentsNew, tournamentsUpdated, tournamentsDeduplicated, newTournamentIds };
}
