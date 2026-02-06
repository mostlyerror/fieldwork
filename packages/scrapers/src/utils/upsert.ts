import { supabase } from "./supabase.js";
import type { ScrapedTournament } from "../types.js";

export interface UpsertStats {
  tournamentsNew: number;
  tournamentsUpdated: number;
}

/**
 * Upsert a batch of scraped tournaments into the database.
 *
 * Logic per tournament:
 * 1. Look for existing tournament by (source_platform, source_url)
 * 2. If not found → insert (new)
 * 3. If found and source_hash differs → update (changed)
 * 4. If found and source_hash matches → skip (unchanged)
 */
export async function upsertTournaments(
  tournaments: ScrapedTournament[]
): Promise<UpsertStats> {
  let tournamentsNew = 0;
  let tournamentsUpdated = 0;

  for (const t of tournaments) {
    try {
      // Check if tournament already exists by source
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

      if (!existing) {
        // New tournament — insert
        const { error: insertError } = await supabase
          .from("tournaments")
          .insert(row);

        if (insertError) {
          console.error(
            `[upsert] Error inserting "${t.name}":`,
            insertError
          );
        } else {
          tournamentsNew++;
          console.log(`[upsert] NEW: "${t.name}" (${t.dateStart})`);
        }
      } else if (existing.source_hash !== t.rawPageHash) {
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
    } catch (err) {
      console.error(`[upsert] Unexpected error for "${t.name}":`, err);
    }
  }

  return { tournamentsNew, tournamentsUpdated };
}
