// packages/scrapers/test/resolve-venue.test.ts
import { describe, it, expect, vi } from "vitest";
import { resolveVenue, qualifyVenueName } from "../src/utils/resolve-venue.js";
import type { PlacesVenue } from "../src/utils/places-client.js";

// Minimal fake Supabase that records calls and returns scripted results.
function fakeDb(opts: {
  nearby?: Array<{ id: string; name: string; slug: string; distance_meters: number }>;
  byPlaceId?: { id: string } | null;
  insertedId?: string;
}) {
  const calls = { rpc: 0, insert: 0, selectByPlace: 0 };
  return {
    calls,
    rpc: vi.fn(async () => ({ data: opts.nearby ?? [], error: null })),
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              calls.selectByPlace++;
              return { data: opts.byPlaceId ?? null, error: null };
            },
          }),
        }),
        upsert: () => ({
          select: () => ({
            single: async () => {
              calls.insert++;
              return { data: { id: opts.insertedId ?? "new-venue-id" }, error: null };
            },
          }),
        }),
      };
    },
  } as any;
}

const placesHit: PlacesVenue = {
  placeId: "ChIJabc", name: "Memorial Park Pickleball Center",
  formattedAddress: "6501 Memorial Dr", latitude: 29.7641, longitude: -95.4203,
  types: ["establishment", "point_of_interest"],
};

describe("resolveVenue", () => {
  it("reuses a nearby venue with similar name and makes NO Places call", async () => {
    const db = fakeDb({ nearby: [{ id: "existing-1", name: "Memorial Park Pickleball", slug: "memorial-park", distance_meters: 30 }] });
    const places = vi.fn(async () => placesHit);
    const id = await resolveVenue(
      { name: "Memorial Park PB Courts", address: null, latitude: 29.7642, longitude: -95.4204 },
      { db, places },
    );
    expect(id).toBe("existing-1");
    expect(places).not.toHaveBeenCalled();
  });

  it("calls Places exactly once when no nearby match, then upserts", async () => {
    const db = fakeDb({ nearby: [], byPlaceId: null, insertedId: "v-new" });
    const places = vi.fn(async () => placesHit);
    const id = await resolveVenue(
      { name: "Memorial Park Pickleball", address: "6501 Memorial Dr", latitude: 29.7641, longitude: -95.4203 },
      { db, places },
    );
    expect(places).toHaveBeenCalledTimes(1);
    expect(id).toBe("v-new");
  });

  it("collapses to existing venue when place_id already exists", async () => {
    const db = fakeDb({ nearby: [], byPlaceId: { id: "v-existing-place" } });
    const places = vi.fn(async () => placesHit);
    const id = await resolveVenue(
      { name: "Mem Park", address: null, latitude: 29.7641, longitude: -95.4203 },
      { db, places },
    );
    expect(id).toBe("v-existing-place");
  });

  it("leaves the tournament unlinked when Places misses and no athletic venue is nearby", async () => {
    const db = fakeDb({ nearby: [], byPlaceId: null });
    const places = vi.fn(async () => null);
    const nearby = vi.fn(async () => null);
    const id = await resolveVenue(
      { name: "Backyard Courts", address: null, latitude: 30.1, longitude: -95.5 },
      { db, places, nearby },
    );
    expect(nearby).toHaveBeenCalledTimes(1);
    expect(id).toBeNull();
  });

  it("leaves it unlinked when name is a bare locality and no athletic venue is nearby", async () => {
    const db = fakeDb({ nearby: [], byPlaceId: null });
    const cityHit: PlacesVenue = { placeId: "ChIJcity", name: "Missouri City", formattedAddress: "Missouri City, TX, USA", latitude: 29.6, longitude: -95.5, types: ["locality", "political"] };
    const places = vi.fn(async () => cityHit);
    const nearby = vi.fn(async () => null);
    const id = await resolveVenue(
      { name: "Missouri City", address: null, latitude: 29.6, longitude: -95.5 },
      { db, places, nearby },
    );
    expect(places).toHaveBeenCalledTimes(1);
    expect(nearby).toHaveBeenCalledTimes(1);
    expect(id).toBeNull();
  });

  it("falls back to Nearby Search and links the athletic venue when the TD typed a bare city", async () => {
    const db = fakeDb({ nearby: [], byPlaceId: null, insertedId: "v-lifetime" });
    const cityHit: PlacesVenue = { placeId: "ChIJcity", name: "Missouri City", formattedAddress: "Missouri City, TX", latitude: 29.5424, longitude: -95.5448, types: ["locality", "political"] };
    const places = vi.fn(async () => cityHit);
    const lifeTime: PlacesVenue = { placeId: "ChIJlt", name: "Life Time", formattedAddress: "8421 Hwy 6", latitude: 29.5424, longitude: -95.5448, types: ["gym", "fitness_center", "establishment", "point_of_interest"] };
    const nearby = vi.fn(async () => lifeTime);
    const id = await resolveVenue(
      { name: "Missouri City", address: "8421 Hwy 6, Missouri City, TX", latitude: 29.5424, longitude: -95.5448 },
      { db, places, nearby },
    );
    expect(nearby).toHaveBeenCalledTimes(1);
    expect(id).toBe("v-lifetime");
  });

  it("ignores a non-athletic nearby result (e.g. a spa) and stays unlinked", async () => {
    const db = fakeDb({ nearby: [], byPlaceId: null });
    const places = vi.fn(async () => null);
    const spa: PlacesVenue = { placeId: "ChIJspa", name: "Serenity Spa", formattedAddress: "x", latitude: 29.6, longitude: -95.5, types: ["spa", "establishment", "point_of_interest"] };
    const nearby = vi.fn(async () => spa);
    const id = await resolveVenue(
      { name: "Missouri City", address: null, latitude: 29.6, longitude: -95.5 },
      { db, places, nearby },
    );
    expect(id).toBeNull();
  });

  it("leaves non-geographic labels unlinked without calling Places", async () => {
    const db = fakeDb({});
    const places = vi.fn(async () => placesHit);
    const id = await resolveVenue(
      { name: "Unknown", address: null, latitude: null, longitude: null },
      { db, places },
    );
    expect(places).not.toHaveBeenCalled();
    expect(id).toBeNull();
  });
});

describe("qualifyVenueName", () => {
  it("appends the locality to a Places brand label", () => {
    expect(qualifyVenueName("Life Time", "Missouri City")).toBe(
      "Life Time Missouri City",
    );
  });
  it("is a no-op when the brand already contains the locality", () => {
    expect(qualifyVenueName("Life Time Greenway", "Greenway")).toBe(
      "Life Time Greenway",
    );
  });
  it("appends only the city token, not a full City/ST/ZIP", () => {
    expect(qualifyVenueName("Life Time", "Houston, TX, 77007")).toBe(
      "Life Time Houston",
    );
  });
  it("leaves an already location-specific brand untouched", () => {
    expect(
      qualifyVenueName("Elite Pickleball Club - The Heights", "Houston, TX, 77007"),
    ).toBe("Elite Pickleball Club - The Heights");
  });
});
