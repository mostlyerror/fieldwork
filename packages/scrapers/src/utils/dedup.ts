import { supabase } from "./supabase.js";

const MAX_DISTANCE_METERS = 100; // ~330 ft

export interface CanonicalMatch {
  id: string;
  name: string;
}

/**
 * Find an existing canonical tournament that matches by date and GPS proximity.
 * Returns the match if one exists within 100m on the same start date.
 */
export async function findCanonicalMatch(
  dateStart: string,
  latitude: number,
  longitude: number
): Promise<CanonicalMatch | null> {
  const { data, error } = await supabase.rpc("find_nearby_tournament", {
    p_date_start: dateStart,
    p_lat: latitude,
    p_lng: longitude,
    p_max_distance_meters: MAX_DISTANCE_METERS,
  });

  if (error) {
    console.error("[dedup] Error calling find_nearby_tournament:", error);
    return null;
  }

  if (data && data.length > 0) {
    return { id: data[0].id, name: data[0].name };
  }

  return null;
}

/**
 * Record a source entry for a tournament in the tournament_sources table.
 */
export async function addTournamentSource(
  tournamentId: string,
  sourcePlatform: string,
  sourceUrl: string | null,
  registrationUrl: string | null
): Promise<void> {
  const { error } = await supabase.from("tournament_sources").upsert(
    {
      tournament_id: tournamentId,
      source_platform: sourcePlatform,
      source_url: sourceUrl,
      registration_url: registrationUrl,
    },
    { onConflict: "tournament_id,source_platform,source_url" }
  );

  if (error) {
    console.error(
      `[dedup] Error adding source (${sourcePlatform}) for tournament ${tournamentId}:`,
      error
    );
  }
}
