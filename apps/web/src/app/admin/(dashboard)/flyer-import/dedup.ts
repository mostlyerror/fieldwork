import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_DISTANCE_METERS = 100;

export interface DuplicateMatch {
  id: string;
  name: string;
}

/**
 * Reuse the scraper's find_nearby_tournament RPC (same date + 100m, canonical
 * rows only) to warn before double-creating. The RPC has no status filter, so it
 * also catches existing flyer drafts.
 */
export async function findFlyerDuplicate(
  admin: SupabaseClient,
  dateStart: string | null,
  latitude: number | null,
  longitude: number | null,
): Promise<DuplicateMatch | null> {
  if (!dateStart || latitude == null || longitude == null) return null;
  const { data, error } = await admin.rpc("find_nearby_tournament", {
    p_date_start: dateStart,
    p_lat: latitude,
    p_lng: longitude,
    p_max_distance_meters: MAX_DISTANCE_METERS,
  });
  if (error || !data || data.length === 0) return null;
  return { id: data[0].id, name: data[0].name };
}
