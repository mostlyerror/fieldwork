// packages/scrapers/test/venue-identity.test.ts
import { describe, it, expect } from "vitest";
import { normalizeVenueName, nameSimilarity, venueDedupKey, roundCoord, venueDisplayName, hasLocaleSuffix } from "../src/utils/venue-identity.js";

describe("normalizeVenueName", () => {
  it("lowercases, strips punctuation and noise tokens", () => {
    expect(normalizeVenueName("The Memorial Park Pickleball Courts")).toBe("memorial park");
  });
  it("keeps distinctive tokens", () => {
    expect(normalizeVenueName("Bayou City Sports Club")).toBe("bayou city sports");
  });
});

describe("nameSimilarity", () => {
  it("scores spelling drift of same venue >= 0.5", () => {
    const a = normalizeVenueName("Memorial Park Pickleball");
    const b = normalizeVenueName("Memorial Park PB Courts");
    expect(nameSimilarity(a, b)).toBeGreaterThanOrEqual(0.5);
  });
  it("treats subset as match (1.0)", () => {
    expect(nameSimilarity("memorial park", "memorial park sports")).toBe(1);
  });
  it("scores different venues low", () => {
    expect(nameSimilarity(normalizeVenueName("Memorial Park"), normalizeVenueName("Westside Tennis"))).toBeLessThan(0.5);
  });
});

describe("roundCoord", () => {
  it("rounds to 5 decimals", () => {
    expect(roundCoord(29.7604123)).toBe("29.76041");
    expect(roundCoord(null)).toBe("na");
  });
});

describe("venueDedupKey", () => {
  it("uses place: prefix when place_id present", () => {
    expect(venueDedupKey({ placeId: "ChIJabc", name: "X", latitude: 1, longitude: 2 })).toBe("place:ChIJabc");
  });
  it("uses loc: prefix with normalized name + rounded coords when no place_id", () => {
    expect(venueDedupKey({ placeId: null, name: "The Memorial Park Pickleball", latitude: 29.7604123, longitude: -95.3698456 }))
      .toBe("loc:memorial park:29.76041:-95.36985");
  });
  it("uses :na: for missing coords", () => {
    expect(venueDedupKey({ placeId: null, name: "Unknown", latitude: null, longitude: null }))
      .toBe("loc::na:na");
  });
});

describe("venueDisplayName", () => {
  it("disambiguates a chain name with the scraped locale token", () => {
    expect(venueDisplayName("Life Time", "Life Time Greenway")).toBe("Life Time — Greenway");
    expect(venueDisplayName("Life Time", "Galleria Life Time")).toBe("Life Time — Galleria");
  });
  it("uses a non-overlapping scraped token (neighborhood) as the suffix", () => {
    expect(venueDisplayName("Life Time", "Champions")).toBe("Life Time — Champions");
  });
  it("keeps the Places name when the scraped name adds nothing", () => {
    expect(venueDisplayName("Chicken N Pickle - Webster", "Chicken N Pickle - Webster")).toBe("Chicken N Pickle - Webster");
  });
  it("falls back to the scraped name when Places returns a bare street address", () => {
    expect(venueDisplayName("8421 Hwy 6", "Missouri City")).toBe("Missouri City");
  });
  it("ignores noise tokens when computing the suffix", () => {
    // "pickleball"/"club" are noise → no spurious suffix
    expect(venueDisplayName("PACE Pickleball Club", "Pace Pickleball Club")).toBe("PACE Pickleball Club");
  });
});

describe("hasLocaleSuffix", () => {
  it("detects the em-dash locale suffix", () => {
    expect(hasLocaleSuffix("Life Time — Greenway")).toBe(true);
    expect(hasLocaleSuffix("Missouri City")).toBe(false);
  });
});
