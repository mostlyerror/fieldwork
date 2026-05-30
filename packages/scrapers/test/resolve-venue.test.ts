// packages/scrapers/test/resolve-venue.test.ts
import { describe, it, expect, vi } from "vitest";
import { resolveVenue } from "../src/utils/resolve-venue.js";
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

  it("creates a fallback venue when Places misses", async () => {
    const db = fakeDb({ nearby: [], byPlaceId: null, insertedId: "v-fallback" });
    const places = vi.fn(async () => null);
    const id = await resolveVenue(
      { name: "Backyard Courts", address: null, latitude: 30.1, longitude: -95.5 },
      { db, places },
    );
    expect(id).toBe("v-fallback");
  });

  it("returns a shared fallback for non-geographic labels without calling Places", async () => {
    const db = fakeDb({ insertedId: "v-unknown" });
    const places = vi.fn(async () => placesHit);
    const id = await resolveVenue(
      { name: "Unknown", address: null, latitude: null, longitude: null },
      { db, places },
    );
    expect(places).not.toHaveBeenCalled();
    expect(id).toBe("v-unknown");
  });
});
