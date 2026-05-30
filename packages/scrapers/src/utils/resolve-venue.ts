// packages/scrapers/src/utils/resolve-venue.ts
import { realPlacesClient, isEstablishment, type PlacesClient } from "./places-client.js";
import { normalizeVenueName, nameSimilarity, venueDedupKey } from "./venue-identity.js";
import { venueSlug } from "./venue-slug.js";

const PRECHECK_RADIUS_M = 75;
const NAME_SIMILARITY_THRESHOLD = 0.5;
// Two distinct Places place_ids this close are the same physical building (e.g.
// two Google entries for one venue) — merge.
const SAME_BUILDING_M = 35;
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
  const name = loc.name.trim();

  try {
    // Placeholder / non-geographic labels → leave the tournament unlinked.
    if (NON_GEO_LABELS.has(name.toLowerCase())) return null;

    // GPS precheck (free): reuse a nearby venue whose name matches. The TD's
    // name is the venue label, so this is a name-to-name comparison.
    if (loc.latitude != null && loc.longitude != null) {
      const { data: nearby, error } = await db.rpc("find_nearby_venue", {
        p_lat: loc.latitude,
        p_lng: loc.longitude,
        p_max_distance_meters: PRECHECK_RADIUS_M,
      });
      if (!error && Array.isArray(nearby)) {
        const target = normalizeVenueName(name);
        for (const cand of nearby) {
          if (nameSimilarity(target, normalizeVenueName(cand.name)) >= NAME_SIMILARITY_THRESHOLD) {
            return cand.id;
          }
        }
      }
    }

    // Places resolve — Google supplies only the canonical place_id + clean
    // coords. The venue NAME stays the TD-entered name; we never adopt Google's
    // generic chain label.
    const hit = await places({
      name,
      address: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
    });

    // Unresolved, or resolved to a bare locality/street (the TD typed only a
    // city like "Missouri City") → don't invent a venue; leave it unlinked.
    if (!hit || !isEstablishment(hit.types)) return null;

    // place_id re-check: the same canonical place under a different TD spelling.
    const { data: existing } = await db
      .from("venues")
      .select("id")
      .eq("place_id", hit.placeId)
      .maybeSingle();
    if (existing?.id) return existing.id;

    // Same-building merge: an existing venue at these precise coords with a
    // different place_id (two Google entries for one building) is the same place.
    if (hit.latitude != null && hit.longitude != null) {
      const { data: near, error: nErr } = await db.rpc("find_nearby_venue", {
        p_lat: hit.latitude,
        p_lng: hit.longitude,
        p_max_distance_meters: SAME_BUILDING_M,
      });
      if (!nErr && Array.isArray(near) && near.length > 0) return near[0].id;
    }

    // New venue: TD's name as the label, Google's place_id / address / coords.
    return upsertVenue(db, {
      placeId: hit.placeId,
      name,
      formattedAddress: hit.formattedAddress,
      latitude: hit.latitude,
      longitude: hit.longitude,
      source: "places",
    });
  } catch (err) {
    console.error(`[resolve-venue] error resolving "${name}":`, err);
    return null;
  }
}
