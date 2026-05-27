import { describe, it, expect } from "vitest";
import { parseMedalNames } from "../src/utils/placements.js";

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
