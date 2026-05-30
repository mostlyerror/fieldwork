// packages/scrapers/test/places-client.test.ts
import { describe, it, expect } from "vitest";
import { mapSearchTextResponse, isEstablishment } from "../src/utils/places-client.js";

describe("mapSearchTextResponse", () => {
  it("maps a hit to a venue shape", () => {
    const json = {
      places: [{
        id: "ChIJabc123",
        displayName: { text: "Memorial Park Pickleball Center" },
        formattedAddress: "6501 Memorial Dr, Houston, TX 77007, USA",
        location: { latitude: 29.7641, longitude: -95.4203 },
        types: ["establishment", "point_of_interest"],
      }],
    };
    expect(mapSearchTextResponse(json)).toEqual({
      placeId: "ChIJabc123",
      name: "Memorial Park Pickleball Center",
      formattedAddress: "6501 Memorial Dr, Houston, TX 77007, USA",
      latitude: 29.7641,
      longitude: -95.4203,
      types: ["establishment", "point_of_interest"],
    });
  });
  it("defaults types to [] when absent", () => {
    const json = { places: [{ id: "x", displayName: { text: "Y" } }] };
    expect(mapSearchTextResponse(json)?.types).toEqual([]);
  });
  it("returns null when places is empty or missing", () => {
    expect(mapSearchTextResponse({ places: [] })).toBeNull();
    expect(mapSearchTextResponse({})).toBeNull();
  });
});

describe("isEstablishment", () => {
  it("accepts real venues", () => {
    expect(isEstablishment(["gym", "sports_complex", "point_of_interest", "establishment"])).toBe(true);
    expect(isEstablishment(["restaurant", "point_of_interest"])).toBe(true);
  });
  it("rejects bare localities / addresses", () => {
    expect(isEstablishment(["locality", "political"])).toBe(false);
    expect(isEstablishment(["street_address"])).toBe(false);
    expect(isEstablishment([])).toBe(false);
  });
});
