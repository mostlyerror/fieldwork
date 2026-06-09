import { describe, it, expect } from "vitest";
import { parseMedalNames, nameMatch } from "../src/utils/placements.js";

describe("nameMatch", () => {
  it("matches identical names case/space-insensitively", () => {
    expect(nameMatch("Chris Dixon", "chris  dixon")).toBe(true);
  });
  it("matches a full surname against the roster's truncated initial", () => {
    // PBB medal API returns "Hue Wong"; the public roster stores "Hue W".
    expect(nameMatch("Hue Wong", "Hue W")).toBe(true);
    expect(nameMatch("Teejay A", "Teejay Alvarez")).toBe(true);
  });
  it("does not match when first names differ", () => {
    expect(nameMatch("Hue Wong", "Sue W")).toBe(false);
  });
  it("does not match when the surname initial differs", () => {
    expect(nameMatch("Hue Wong", "Hue T")).toBe(false);
  });
  it("does not match unrelated single names", () => {
    expect(nameMatch("Madonna", "Cher")).toBe(false);
  });
});

describe("parseMedalNames", () => {
  it("parses doubles team from HTML br tag", () => {
    expect(parseMedalNames("Janet Kwon<br>Blanca Tejada")).toEqual(["Janet Kwon", "Blanca Tejada"]);
  });
  it("parses singles player (no br tag)", () => {
    expect(parseMedalNames("John Smith")).toEqual(["John Smith"]);
  });
  it("returns empty array for empty string", () => {
    expect(parseMedalNames("")).toEqual([]);
  });
  it("trims whitespace", () => {
    expect(parseMedalNames("  Lynn Cao <br> Tina Phan  ")).toEqual(["Lynn Cao", "Tina Phan"]);
  });
  it("handles br variants", () => {
    expect(parseMedalNames("A Player<br/>B Player")).toEqual(["A Player", "B Player"]);
    expect(parseMedalNames("A Player<br />B Player")).toEqual(["A Player", "B Player"]);
  });
});
