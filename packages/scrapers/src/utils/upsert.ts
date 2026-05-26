import { supabase } from "./supabase.js";
import { findCanonicalMatch, addTournamentSource } from "./dedup.js";
import { parseEventName } from "./parse-event-name.js";
import { computeFieldStrength, computeSandbaggerPct, computeAvgDupr } from "./intelligence.js";
import type { ScrapedTournament, ScrapedEvent, ScrapedPlayer } from "../types.js";

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
/**
 * Sanity-check: if date_end is set and date_start is more than 7 days
 * before date_end, the dates are likely wrong (e.g. registration open
 * date stored as tournament start). Log a warning and skip the record.
 */
function hasPlausibleDates(t: ScrapedTournament): boolean {
  if (!t.dateEnd) return true;
  const start = new Date(t.dateStart);
  const end = new Date(t.dateEnd);
  const spanDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (spanDays > 7) {
    console.warn(
      `[upsert] SKIP "${t.name}": date span is ${Math.round(spanDays)} days (${t.dateStart} → ${t.dateEnd}) — likely registration dates, not tournament dates`,
    );
    return false;
  }
  return true;
}

export async function upsertTournaments(
  tournaments: ScrapedTournament[]
): Promise<UpsertStats> {
  let tournamentsNew = 0;
  let tournamentsUpdated = 0;
  let tournamentsDeduplicated = 0;
  const newTournamentIds: string[] = [];

  for (const t of tournaments) {
    if (!hasPlausibleDates(t)) continue;
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

/**
 * Upsert players into the persistent `players` table by source_player_id.
 * Returns a map of sourcePlayerId → players.id for FK linkage.
 */
async function upsertPlayers(
  allPlayers: ScrapedPlayer[],
): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();

  // Collect unique players by sourcePlayerId
  const uniqueBySource = new Map<string, ScrapedPlayer>();
  for (const p of allPlayers) {
    if (p.sourcePlayerId) {
      // Keep the latest occurrence (may have updated DUPR)
      uniqueBySource.set(p.sourcePlayerId, p);
    }
    // Also track partners as players
    if (p.partnerSourcePlayerId && p.partnerName) {
      if (!uniqueBySource.has(p.partnerSourcePlayerId)) {
        uniqueBySource.set(p.partnerSourcePlayerId, {
          name: p.partnerName,
          duprRating: p.partnerDuprRating,
          sourcePlayerId: p.partnerSourcePlayerId,
        });
      }
    }
  }

  if (uniqueBySource.size === 0) return idMap;

  // Batch upsert in chunks (Supabase has row limits)
  const entries = Array.from(uniqueBySource.entries());
  const BATCH_SIZE = 500;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const sourceIds = batch.map(([sid]) => sid);
    const { data: existing } = await supabase
      .from("players")
      .select("source_player_id, dupr_verified")
      .in("source_player_id", sourceIds);

    const verifiedSet = new Set(
      (existing ?? []).filter((r) => r.dupr_verified).map((r) => r.source_player_id)
    );

    const rows = batch.map(([sourcePlayerId, p]) => ({
      source_player_id: sourcePlayerId,
      source_platform: "pickleballbrackets" as const,
      name: p.name,
      slug: p.sourceSlug ?? null,
      location: p.location ?? null,
      gender: p.gender ?? null,
      // Don't overwrite live DUPR with stale PBB rating
      ...(verifiedSet.has(sourcePlayerId) ? {} : { dupr_rating: p.duprRating ?? null }),
    }));

    const { data, error } = await supabase
      .from("players")
      .upsert(rows, { onConflict: "source_player_id" })
      .select("id, source_player_id");

    if (error) {
      console.error(`[upsert-players] Error upserting player batch:`, error);
      continue;
    }

    if (data) {
      for (const row of data) {
        idMap.set(row.source_player_id, row.id);
      }
    }
  }

  console.log(
    `[upsert-players] Upserted ${idMap.size} unique players`,
  );
  return idMap;
}

/**
 * Upsert events and players for a tournament.
 * Deletes existing events/players for the tournament and re-inserts
 * (simpler and more reliable than diffing).
 */
export async function upsertEvents(
  tournamentId: string,
  events: ScrapedEvent[],
): Promise<void> {
  // Collect all players across events for batch upsert into players table
  const allPlayers: ScrapedPlayer[] = [];
  for (const event of events) {
    allPlayers.push(...event.players);
  }

  // Upsert persistent players and get sourcePlayerId → players.id map
  const playerIdMap = await upsertPlayers(allPlayers);

  // Delete existing events (cascades to event_players)
  const { error: deleteError } = await supabase
    .from("tournament_events")
    .delete()
    .eq("tournament_id", tournamentId);

  if (deleteError) {
    console.error(
      `[upsert-events] Error deleting existing events for ${tournamentId}:`,
      deleteError,
    );
    return;
  }

  for (const event of events) {
    const parsed = parseEventName(event.name);
    const avgDupr = computeAvgDupr(event.players);

    const skillMin = event.skillLevelMin ?? parsed.skillMin;
    const skillMax = event.skillLevelMax ?? parsed.skillMax;

    let fieldStrength: number | null = null;
    let sandbaggerPct: number | null = null;

    if (avgDupr != null && skillMin != null && skillMax != null && skillMax > skillMin) {
      fieldStrength = Math.round(computeFieldStrength(skillMin, skillMax, avgDupr) * 100) / 100;
      sandbaggerPct = Math.round(computeSandbaggerPct(event.players, skillMin, skillMax) * 100) / 100;
    }

    const { data: insertedEvent, error: eventError } = await supabase
      .from("tournament_events")
      .insert({
        tournament_id: tournamentId,
        name: event.name,
        event_type: event.eventType ?? parsed.eventType,
        gender: event.gender ?? parsed.gender,
        skill_level_min: skillMin,
        skill_level_max: skillMax,
        max_teams: event.maxTeams ?? null,
        registered_count: event.registeredCount ?? event.players.length,
        avg_dupr: avgDupr,
        field_strength: fieldStrength,
        sandbagger_pct: sandbaggerPct,
        source_event_id: event.sourceEventId ?? null,
      })
      .select("id")
      .single();

    if (eventError || !insertedEvent) {
      console.error(
        `[upsert-events] Error inserting event "${event.name}":`,
        eventError,
      );
      continue;
    }

    // Insert players for this event
    if (event.players.length > 0) {
      const playerRows = event.players.map((p) => ({
        event_id: insertedEvent.id,
        player_name: p.name,
        dupr_rating: p.duprRating ?? null,
        partner_name: p.partnerName ?? null,
        partner_dupr_rating: p.partnerDuprRating ?? null,
        team_avg_dupr:
          p.duprRating != null && p.partnerDuprRating != null
            ? Math.round(((p.duprRating + p.partnerDuprRating) / 2) * 100) / 100
            : null,
        player_id: p.sourcePlayerId ? (playerIdMap.get(p.sourcePlayerId) ?? null) : null,
        partner_id: p.partnerSourcePlayerId ? (playerIdMap.get(p.partnerSourcePlayerId) ?? null) : null,
      }));

      const { error: playersError } = await supabase
        .from("event_players")
        .insert(playerRows);

      if (playersError) {
        console.error(
          `[upsert-events] Error inserting players for "${event.name}":`,
          playersError,
        );
      }
    }

    console.log(
      `[upsert-events] Event "${event.name}": ${event.players.length} players, avgDUPR=${avgDupr ?? "N/A"}, fieldStrength=${fieldStrength ?? "N/A"}`,
    );
  }
}
