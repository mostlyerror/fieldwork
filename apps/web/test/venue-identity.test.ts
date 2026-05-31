import { describe, it, expect } from "vitest";
import {
  normalizeVenueName,
  roundCoord,
  venueDedupKey,
} from "@/lib/venue-identity";

describe("normalizeVenueName", () => {
  it("strips noise tokens and punctuation, keeps distinctive words", () => {
    expect(normalizeVenueName("The Memorial Park Pickleball Courts")).toBe(
      "memorial park",
    );
  });
  it("normalizes non-geographic placeholders to empty", () => {
    expect(normalizeVenueName("TBD")).toBe("");
  });
});

describe("roundCoord", () => {
  it("rounds to 5 decimals", () => {
    expect(roundCoord(29.7604567)).toBe("29.76046");
  });
  it("returns 'na' for null", () => {
    expect(roundCoord(null)).toBe("na");
  });
});

describe("venueDedupKey", () => {
  it("prefers place_id when present", () => {
    expect(
      venueDedupKey({ placeId: "abc123", name: "X", latitude: 1, longitude: 2 }),
    ).toBe("place:abc123");
  });
  it("falls back to normalized name + coords", () => {
    expect(
      venueDedupKey({
        placeId: null,
        name: "Memorial Park Courts",
        latitude: 29.7604567,
        longitude: -95.3698028,
      }),
    ).toBe("loc:memorial park:29.76046:-95.36980");
  });
});

import { upsertVenueFromSelection } from "@/lib/venues";

function makeAdmin(returnId: string) {
  const calls: { table: string; row: Record<string, unknown>; onConflict: string }[] = [];
  const admin = {
    from(table: string) {
      return {
        upsert(row: Record<string, unknown>, opts: { onConflict: string }) {
          calls.push({ table, row, onConflict: opts.onConflict });
          return {
            select() {
              return {
                single: () =>
                  Promise.resolve({ data: { id: returnId }, error: null }),
              };
            },
          };
        },
      };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { admin: admin as any, calls };
}

describe("upsertVenueFromSelection", () => {
  it("upserts on dedup_key=place:<id> and returns the venue id", async () => {
    const { admin, calls } = makeAdmin("venue-77");
    const id = await upsertVenueFromSelection(admin, {
      locationName: "Memorial Park Courts",
      locationAddress: "6501 Memorial Dr, Houston, TX",
      latitude: 29.7644,
      longitude: -95.3905,
      placeId: "place-xyz",
    });
    expect(id).toBe("venue-77");
    expect(calls[0].table).toBe("venues");
    expect(calls[0].onConflict).toBe("dedup_key");
    expect(calls[0].row.dedup_key).toBe("place:place-xyz");
    expect(calls[0].row.place_id).toBe("place-xyz");
    expect(calls[0].row.slug).toBe("memorial-park-courts");
    expect(calls[0].row.source).toBe("places");
  });

  it("retries with a suffixed slug on a slug unique violation, then succeeds", async () => {
    const slugs: string[] = [];
    let call = 0;
    const admin = {
      from() {
        return {
          upsert(row: Record<string, unknown>, _opts: { onConflict: string }) {
            slugs.push(row.slug as string);
            return {
              select() {
                return {
                  single: () => {
                    call += 1;
                    return call === 1
                      ? Promise.resolve({
                          data: null,
                          error: {
                            code: "23505",
                            message:
                              'duplicate key value violates unique constraint "venues_slug_key"',
                          },
                        })
                      : Promise.resolve({ data: { id: "venue-99" }, error: null });
                  },
                };
              },
            };
          },
        };
      },
    };
    const id = await upsertVenueFromSelection(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      {
        locationName: "Memorial Park Courts",
        locationAddress: "",
        latitude: 29.7644,
        longitude: -95.3905,
        placeId: "place-xyz",
      },
    );
    expect(id).toBe("venue-99");
    expect(slugs).toHaveLength(2);
    expect(slugs[0]).toBe("memorial-park-courts");
    expect(slugs[1]).toMatch(/^memorial-park-courts-[a-z0-9]{1,4}$/);
    expect(slugs[1]).not.toBe(slugs[0]);
  });

  it("returns null when the upsert errors", async () => {
    const admin = {
      from: () => ({
        upsert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({ data: null, error: { message: "boom" } }),
          }),
        }),
      }),
    };
    const id = await upsertVenueFromSelection(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      {
        locationName: "X",
        locationAddress: "",
        latitude: 0,
        longitude: 0,
        placeId: "p1",
      },
    );
    expect(id).toBeNull();
  });
});
