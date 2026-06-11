import { describe, it, expect } from "vitest";
import { parseMedalNames, nameMatch, findMedalTeamInRoster } from "../src/utils/placements.js";

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

describe("findMedalTeamInRoster", () => {
  const roster = [
    { playerFullName: "Karli Thomas", partnerFullName: "Elijah C", isRegistered: true },
    { playerFullName: "Sammi Guse", partnerFullName: "Pratik Sahajwani", isRegistered: true },
    { playerFullName: "Withdrawn Pair", partnerFullName: "Gone Player", isRegistered: false },
    { playerFullName: "Solo Singles", isRegistered: true },
  ];

  it("finds a doubles team regardless of medal name order", () => {
    expect(findMedalTeamInRoster(roster, ["Sammi Guse", "Pratik Sahajwani"])?.playerFullName).toBe("Sammi Guse");
    expect(findMedalTeamInRoster(roster, ["Pratik Sahajwani", "Sammi Guse"])?.playerFullName).toBe("Sammi Guse");
  });

  it("matches truncated roster surnames against full medal names", () => {
    expect(findMedalTeamInRoster(roster, ["Karli Thomas", "Elijah Cruz"])?.playerFullName).toBe("Karli Thomas");
  });

  it("finds a singles medalist", () => {
    expect(findMedalTeamInRoster(roster, ["Solo Singles"])?.playerFullName).toBe("Solo Singles");
  });

  it("ignores unregistered (withdrawn/waitlisted) entries", () => {
    expect(findMedalTeamInRoster(roster, ["Withdrawn Pair", "Gone Player"])).toBeNull();
  });

  it("returns null when the team is not in the roster", () => {
    expect(findMedalTeamInRoster(roster, ["Nobody Here", "Also Missing"])).toBeNull();
  });

  it("does not match a doubles medal team against a singles entry", () => {
    expect(findMedalTeamInRoster(roster, ["Solo Singles", "Phantom Partner"])).toBeNull();
  });
});

describe("nameMatch suffixes", () => {
  it("matches when the medal API includes a generational suffix the roster omits", () => {
    expect(nameMatch("Edward Muniz Jr", "Edward Muniz")).toBe(true);
    expect(nameMatch("Edward Muniz", "Edward Muniz Jr.")).toBe(true);
    expect(nameMatch("Robert Smith III", "Robert Smith")).toBe(true);
  });
  it("still matches suffix + truncated-initial combined", () => {
    expect(nameMatch("Edward Muniz Jr", "Edward M")).toBe(true);
  });
  it("leaves a two-token roster initial that looks like a suffix alone", () => {
    expect(nameMatch("Hue V", "Hue Vo")).toBe(true);
    expect(nameMatch("Hue V", "Hue Wong")).toBe(false);
  });
  it("does not equate different people who share a suffix", () => {
    expect(nameMatch("Edward Muniz Jr", "Carlos Vega Jr")).toBe(false);
  });
});
