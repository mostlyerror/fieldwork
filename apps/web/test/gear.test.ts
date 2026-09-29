import { describe, it, expect } from "vitest";
import { ratingBand, tournamentBand, gearLinks } from "@/lib/gear";

describe("ratingBand", () => {
  it("splits at 3.5 and 4.5", () => {
    expect(ratingBand(2.9)).toBe("beginner");
    expect(ratingBand(3.49)).toBe("beginner");
    expect(ratingBand(3.5)).toBe("intermediate");
    expect(ratingBand(4.49)).toBe("intermediate");
    expect(ratingBand(4.5)).toBe("advanced");
  });

  it("defaults to intermediate with no rating", () => {
    expect(ratingBand(null)).toBe("intermediate");
    expect(ratingBand(undefined)).toBe("intermediate");
    expect(ratingBand(NaN)).toBe("intermediate");
  });
});

describe("tournamentBand", () => {
  it("uses the median skill cap, treating a cap as inside its band", () => {
    const ev = (m: number | null) => ({ skill_level_max: m });
    expect(tournamentBand([ev(3.0), ev(3.5), ev(4.0)])).toBe("beginner");
    expect(tournamentBand([ev(4.0), ev(4.5), ev(5.0)])).toBe("intermediate");
    expect(tournamentBand([ev(5.0), ev(5.5), ev(null)])).toBe("advanced");
  });

  it("defaults to intermediate when no event has a cap", () => {
    expect(tournamentBand([])).toBe("intermediate");
    expect(tournamentBand([{ skill_level_max: null }])).toBe("intermediate");
  });
});

describe("gearLinks", () => {
  it("returns nothing without a tag", () => {
    expect(gearLinks("beginner", undefined)).toEqual([]);
    expect(gearLinks("beginner", "")).toEqual([]);
    expect(gearLinks("beginner", "   ")).toEqual([]);
  });

  it("tags every link", () => {
    const links = gearLinks("advanced", "pickleradar-20");
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      const u = new URL(l.href);
      expect(u.hostname).toBe("www.amazon.com");
      expect(u.searchParams.get("tag")).toBe("pickleradar-20");
      expect(u.searchParams.get("k")).toBeTruthy();
    }
  });
});
