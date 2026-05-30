// packages/scrapers/test/venue-slug.test.ts
import { describe, it, expect } from "vitest";
import { venueSlug } from "../src/utils/venue-slug.js";

describe("venueSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(venueSlug("Memorial Park Pickleball Courts")).toBe("memorial-park-pickleball-courts");
  });
  it("strips punctuation and collapses separators", () => {
    expect(venueSlug("Bayou City P.B. & Rec!")).toBe("bayou-city-p-b-rec");
  });
  it("trims leading/trailing hyphens", () => {
    expect(venueSlug("  --Westside--  ")).toBe("westside");
  });
  it("truncates to 60 chars without trailing hyphen", () => {
    const long = "a".repeat(80);
    const s = venueSlug(long);
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });
  it("returns 'venue' for empty/symbol-only input", () => {
    expect(venueSlug("!!!")).toBe("venue");
    expect(venueSlug("")).toBe("venue");
  });
});
