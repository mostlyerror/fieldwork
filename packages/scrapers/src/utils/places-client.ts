// packages/scrapers/src/utils/places-client.ts
export interface PlacesVenue {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  types: string[];
  /** Place Photos resource name (e.g. "places/ID/photos/REF"), or null. */
  photoName: string | null;
}

interface SearchTextJson {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    types?: string[];
    photos?: Array<{ name?: string }>;
  }>;
}

export function mapSearchTextResponse(json: SearchTextJson): PlacesVenue | null {
  const p = json.places?.[0];
  if (!p?.id || !p.displayName?.text) return null;
  return {
    placeId: p.id,
    name: p.displayName.text,
    formattedAddress: p.formattedAddress ?? null,
    latitude: p.location?.latitude ?? null,
    longitude: p.location?.longitude ?? null,
    types: p.types ?? [],
    photoName: p.photos?.[0]?.name ?? null,
  };
}

/**
 * True when a Places result is an actual venue/business rather than a bare
 * geographic area or address. A TD who types just a city ("Missouri City")
 * resolves to a locality/street_address — we treat those as unresolved so we
 * don't invent a venue. Real venues carry "establishment"/"point_of_interest".
 */
export function isEstablishment(types: string[]): boolean {
  return types.includes("establishment") || types.includes("point_of_interest");
}

// Sports/recreation types a pickleball venue could plausibly be. Used by the
// Nearby fallback to pick the athletic anchor tenant (e.g. "Life Time") out of
// a multi-tenant building that also holds spas, salons, clinics, etc.
const SPORTS_VENUE_TYPES = new Set([
  "gym",
  "fitness_center",
  "sports_complex",
  "sports_club",
  "sports_activity_location",
  "stadium",
  "arena",
  "athletic_field",
  "recreation_center",
  "park",
]);

export function isSportsVenue(types: string[]): boolean {
  return types.some((t) => SPORTS_VENUE_TYPES.has(t));
}

/**
 * Pure: from a Nearby Search response, pick the first result that is a
 * sports/recreation venue. Returns null when none of the nearby establishments
 * are athletic (so we don't link a tournament to a random massage studio).
 */
export function pickSportsVenue(json: SearchTextJson): PlacesVenue | null {
  for (const p of json.places ?? []) {
    if (!p.id || !p.displayName?.text) continue;
    if (!isSportsVenue(p.types ?? [])) continue;
    return {
      placeId: p.id,
      name: p.displayName.text,
      formattedAddress: p.formattedAddress ?? null,
      latitude: p.location?.latitude ?? null,
      longitude: p.location?.longitude ?? null,
      types: p.types ?? [],
      photoName: p.photos?.[0]?.name ?? null,
    };
  }
  return null;
}

export interface NearbyArgs {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}

// Injectable for tests (mirrors PlacesClient).
export type NearbyPlacesClient = (args: NearbyArgs) => Promise<PlacesVenue | null>;

/**
 * Real Nearby Search: "what athletic venue sits at these coords?" Used when a TD
 * typed a bare city as the location but PBB gave us precise coordinates.
 */
export const realNearbyClient: NearbyPlacesClient = async (args) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("[places] GOOGLE_PLACES_API_KEY not set — skipping nearby");
    return null;
  }
  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.photos",
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: {
          center: { latitude: args.latitude, longitude: args.longitude },
          radius: args.radiusMeters ?? 75,
        },
      },
      maxResultCount: 10,
    }),
  });
  if (!res.ok) {
    console.error(`[places] searchNearby failed: ${res.status}`);
    return null;
  }
  return pickSportsVenue(await res.json());
};

export interface SearchTextArgs {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

// Injectable for tests: defaults to global fetch + env key.
export type PlacesClient = (args: SearchTextArgs) => Promise<PlacesVenue | null>;

export const realPlacesClient: PlacesClient = async (args) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("[places] GOOGLE_PLACES_API_KEY not set — skipping resolve");
    return null;
  }
  const textQuery = [args.name, args.address].filter(Boolean).join(" ");
  const body: Record<string, unknown> = { textQuery, maxResultCount: 1 };
  if (args.latitude != null && args.longitude != null) {
    body.locationBias = {
      circle: {
        center: { latitude: args.latitude, longitude: args.longitude },
        radius: 500.0,
      },
    };
  }
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.photos",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`[places] searchText failed: ${res.status}`);
    return null;
  }
  return mapSearchTextResponse(await res.json());
};

/**
 * Look up a venue's first photo resource name by place_id (Place Details, New).
 * Used by the photo backfill for venues resolved before photos were requested.
 */
export async function fetchPlaceDetailsPhotoName(
  placeId: string,
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "photos" },
  });
  if (!res.ok) {
    console.error(`[places] details failed: ${res.status}`);
    return null;
  }
  const json = (await res.json()) as { photos?: Array<{ name?: string }> };
  return json.photos?.[0]?.name ?? null;
}

/**
 * Download the actual image bytes for a Place Photos resource name. This is the
 * separately-billed Place Photos request — we call it once per venue at ingest
 * (or backfill) and store the result, never per page view.
 */
export async function fetchPlacePhotoBytes(
  photoName: string,
  maxWidthPx = 800,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}`,
    { headers: { "X-Goog-Api-Key": apiKey } },
  );
  if (!res.ok) {
    console.error(`[places] photo media failed: ${res.status}`);
    return null;
  }
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, contentType };
}
