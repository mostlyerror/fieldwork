// packages/scrapers/test/places-client.test.ts
import { describe, it, expect } from "vitest";
import {
  mapSearchTextResponse,
  isEstablishment,
  isSportsVenue,
  pickSportsVenue,
} from "../src/utils/places-client.js";

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
      photoName: null,
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

describe("isSportsVenue", () => {
  it("accepts gyms / fitness / sports complexes", () => {
    expect(isSportsVenue(["gym", "fitness_center", "establishment"])).toBe(true);
    expect(isSportsVenue(["sports_complex", "point_of_interest"])).toBe(true);
    expect(isSportsVenue(["park"])).toBe(true);
  });
  it("rejects co-located non-athletic tenants", () => {
    expect(isSportsVenue(["spa", "massage", "point_of_interest"])).toBe(false);
    expect(isSportsVenue(["chiropractor", "health"])).toBe(false);
    expect(isSportsVenue(["nail_salon", "hair_salon"])).toBe(false);
  });
});

describe("pickSportsVenue", () => {
  it("picks the athletic anchor (Life Time) out of a multi-tenant building", () => {
    // Real-world shape: distance-ranked Nearby results at one address where a
    // massage studio sorts above the gym we actually want.
    const json = {
      places: [
        { id: "spa1", displayName: { text: "Kaitlin Conner - Therapeutic Massage" }, types: ["spa", "massage", "point_of_interest"] },
        { id: "lt1", displayName: { text: "Life Time" }, types: ["gym", "fitness_center", "sports_complex", "establishment"] },
        { id: "spa2", displayName: { text: "LifeSpa Missouri City" }, types: ["spa", "nail_salon"] },
      ],
    };
    expect(pickSportsVenue(json)?.placeId).toBe("lt1");
    expect(pickSportsVenue(json)?.name).toBe("Life Time");
  });
  it("returns null when no nearby establishment is athletic", () => {
    const json = {
      places: [
        { id: "spa1", displayName: { text: "Serenity Spa" }, types: ["spa", "point_of_interest"] },
        { id: "r1", displayName: { text: "Taco Place" }, types: ["restaurant"] },
      ],
    };
    expect(pickSportsVenue(json)).toBeNull();
  });
});
