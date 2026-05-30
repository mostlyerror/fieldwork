// packages/scrapers/src/utils/resolve-venue.ts
import { realPlacesClient, type PlacesClient, type PlacesVenue } from "./places-client.js";
import { normalizeVenueName, nameSimilarity, venueDedupKey } from "./venue-identity.js";
import { venueSlug } from "./venue-slug.js";

const PRECHECK_RADIUS_M = 75;
const NAME_SIMILARITY_THRESHOLD = 0.5;
const NON_GEO_LABELS = new Set(["unknown", "online", "tbd", "tba"]);

export interface ScrapedLocation {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface Deps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
  places?: PlacesClient;
}

// getNearestCity lives in the web package; the scraper duplicates a tiny
// nearest-city for city_slug. With only Houston configured, default to houston.
function nearestCitySlug(_lat: number | null, _lng: number | null): string {
  return "houston";
}

async function upsertVenue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  v: {
    placeId: string | null;
    name: string;
    formattedAddress: string | null;
    latitude: number | null;
    longitude: number | null;
    source: "places" | "fallback";
  },
): Promise<string | null> {
  const dedupKey = venueDedupKey({
    placeId: v.placeId,
    name: v.name,
    latitude: v.latitude,
    longitude: v.longitude,
  });
  const baseSlug = venueSlug(v.name);
  // Stable 4-char suffix from dedup_key to break slug collisions deterministically.
  let hash = 0;
  for (const ch of dedupKey) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const suffix = hash.toString(36).slice(0, 4);

  const attempt = async (slug: string) =>
    db
      .from("venues")
      .upsert(
        {
          place_id: v.placeId,
          dedup_key: dedupKey,
          name: v.name,
          slug,
          formatted_address: v.formattedAddress,
          latitude: v.latitude,
          longitude: v.longitude,
          city_slug: nearestCitySlug(v.latitude, v.longitude),
          source: v.source,
        },
        { onConflict: "dedup_key" },
      )
      .select("id")
      .single();

  let { data, error } = await attempt(baseSlug);
  if (error && /slug/i.test(error.message ?? "")) {
    ({ data, error } = await attempt(`${baseSlug}-${suffix}`));
  }
  if (error) {
    console.error(`[resolve-venue] upsert failed for "${v.name}":`, error);
    return null;
  }
  return data?.id ?? null;
}

export async function resolveVenue(
  loc: ScrapedLocation,
  deps: Deps = {},
): Promise<string | null> {
  // Lazy-load the default service-role client so importing this module (e.g. in
  // unit tests that inject their own db) doesn't require Supabase env vars.
  const db = deps.db ?? (await import("./supabase.js")).supabase;
  const places = deps.places ?? realPlacesClient;

  try {
    // Non-geographic labels: one shared fallback, no Places call, no map.
    if (NON_GEO_LABELS.has(loc.name.trim().toLowerCase())) {
      return upsertVenue(db, {
        placeId: null,
        name: loc.name.trim(),
        formattedAddress: null,
        latitude: null,
        longitude: null,
        source: "fallback",
      });
    }

    // Step 2: GPS precheck (free) — reuse a nearby, similarly-named venue.
    if (loc.latitude != null && loc.longitude != null) {
      const { data: nearby, error } = await db.rpc("find_nearby_venue", {
        p_lat: loc.latitude,
        p_lng: loc.longitude,
        p_max_distance_meters: PRECHECK_RADIUS_M,
      });
      if (!error && Array.isArray(nearby)) {
        const target = normalizeVenueName(loc.name);
        for (const cand of nearby) {
          if (nameSimilarity(target, normalizeVenueName(cand.name)) >= NAME_SIMILARITY_THRESHOLD) {
            return cand.id;
          }
        }
      }
    }

    // Step 3: Places resolve (1 call for genuinely-new locations).
    const hit: PlacesVenue | null = await places({
      name: loc.name,
      address: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
    });

    if (hit) {
      // place_id re-check: collapse different scraped names to one venue.
      const { data: existing } = await db
        .from("venues")
        .select("id")
        .eq("place_id", hit.placeId)
        .maybeSingle();
      if (existing?.id) return existing.id;

      return upsertVenue(db, {
        placeId: hit.placeId,
        name: hit.name,
        formattedAddress: hit.formattedAddress,
        latitude: hit.latitude,
        longitude: hit.longitude,
        source: "places",
      });
    }

    // Step 4: Fallback — deterministic, nothing dropped.
    return upsertVenue(db, {
      placeId: null,
      name: loc.name,
      formattedAddress: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
      source: "fallback",
    });
  } catch (err) {
    console.error(`[resolve-venue] error resolving "${loc.name}":`, err);
    return null;
  }
}
