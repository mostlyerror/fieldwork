// packages/scrapers/test/venue-identity.test.ts
import { describe, it, expect } from "vitest";
import { normalizeVenueName, nameSimilarity, venueDedupKey, roundCoord } from "../src/utils/venue-identity.js";

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
