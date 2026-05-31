import type { SupabaseClient } from "@supabase/supabase-js";
import { venueDedupKey } from "./venue-identity";
import { venueSlug } from "./venue-slug";

// Structurally identical to VenueSelection in apps/web/src/components/venue-search.tsx.
// The form passes a VenueSelection where a ConfirmedVenue is expected — keep fields in sync.
export interface ConfirmedVenue {
  locationName: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

// With only Houston configured, default to houston (mirrors the scraper's
// nearestCitySlug stub in resolve-venue.ts).
function nearestCitySlug(_lat: number, _lng: number): string {
  return "houston";
}

/**
 * Upsert a venue from an admin-confirmed Places selection and return its id.
 * Keyed on dedup_key (place:<placeId>) so it merges with any scraper-created
 * row for the same canonical place. Mirrors the scraper's upsertVenue shape
 * (packages/scrapers/src/utils/resolve-venue.ts) but takes a Places selection
 * that already has a place_id.
 */
export async function upsertVenueFromSelection(
  admin: SupabaseClient,
  v: ConfirmedVenue,
): Promise<string | null> {
  const dedupKey = venueDedupKey({
    placeId: v.placeId || null,
    name: v.locationName,
    latitude: v.latitude,
    longitude: v.longitude,
  });
  const baseSlug = venueSlug(v.locationName);
  let hash = 0;
  for (const ch of dedupKey) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const suffix = hash.toString(36).slice(0, 4);

  const attempt = (slug: string) =>
    admin
      .from("venues")
      .upsert(
        {
          place_id: v.placeId || null,
          dedup_key: dedupKey,
          name: v.locationName,
          slug,
          formatted_address: v.locationAddress || null,
          latitude: v.latitude || null,
          longitude: v.longitude || null,
          city_slug: nearestCitySlug(v.latitude, v.longitude),
          source: "places",
        },
        { onConflict: "dedup_key" },
      )
      .select("id")
      .single();

  let { data, error } = await attempt(baseSlug);
  if (error && error.code === "23505" && /slug/i.test(error.message ?? "")) {
    ({ data, error } = await attempt(`${baseSlug}-${suffix}`));
  }
  if (error) {
    console.error(`[venues] upsert failed for "${v.locationName}":`, error);
    return null;
  }
  return data?.id ?? null;
}
