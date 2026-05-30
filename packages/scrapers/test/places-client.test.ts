// packages/scrapers/test/places-client.test.ts
import { describe, it, expect } from "vitest";
import { mapSearchTextResponse } from "../src/utils/places-client.js";

describe("mapSearchTextResponse", () => {
  it("maps a hit to a venue shape", () => {
    const json = {
      places: [{
        id: "ChIJabc123",
        displayName: { text: "Memorial Park Pickleball Center" },
        formattedAddress: "6501 Memorial Dr, Houston, TX 77007, USA",
        location: { latitude: 29.7641, longitude: -95.4203 },
      }],
    };
    expect(mapSearchTextResponse(json)).toEqual({
      placeId: "ChIJabc123",
      name: "Memorial Park Pickleball Center",
      formattedAddress: "6501 Memorial Dr, Houston, TX 77007, USA",
      latitude: 29.7641,
      longitude: -95.4203,
    });
  });
  it("returns null when places is empty or missing", () => {
    expect(mapSearchTextResponse({ places: [] })).toBeNull();
    expect(mapSearchTextResponse({})).toBeNull();
  });
});
