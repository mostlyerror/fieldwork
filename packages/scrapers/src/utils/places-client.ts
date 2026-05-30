// packages/scrapers/src/utils/places-client.ts
export interface PlacesVenue {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface SearchTextJson {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
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
  };
}

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
        "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`[places] searchText failed: ${res.status}`);
    return null;
  }
  return mapSearchTextResponse(await res.json());
};
