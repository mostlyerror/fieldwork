import { describe, it, expect } from "vitest";
import {
  computeAvgDupr,
  computeFieldStrength,
  computeSandbaggerPct,
} from "../src/utils/intelligence.js";
import type { ScrapedPlayer } from "../src/types.js";

function makePlayer(duprRating: number | undefined): ScrapedPlayer {
  return {
    name: "Test Player",
    duprRating,
  } as ScrapedPlayer;
}

describe("computeAvgDupr", () => {
  it("returns null when no players have ratings", () => {
    expect(computeAvgDupr([makePlayer(undefined)])).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(computeAvgDupr([])).toBeNull();
  });

  it("averages only players with ratings", () => {
    const players = [
      makePlayer(3.0),
      makePlayer(3.2),
      makePlayer(undefined),
    ];
    expect(computeAvgDupr(players)).toBe(3.1);
  });

  it("rounds to two decimal places", () => {
    const players = [makePlayer(3.0), makePlayer(3.1), makePlayer(3.2)];
    // (3.0 + 3.1 + 3.2) / 3 = 3.1
    expect(computeAvgDupr(players)).toBe(3.1);
  });

  it("one outlier below doesn't drag average to 2.88 with mostly 3.0+ players", () => {
    const players = [
      makePlayer(3.0), makePlayer(3.1), makePlayer(3.2),
      makePlayer(3.0), makePlayer(3.1), makePlayer(3.0),
      makePlayer(3.2), makePlayer(3.1), makePlayer(3.0),
      makePlayer(2.0), // one outlier
    ];
    const avg = computeAvgDupr(players)!;
    expect(avg).toBeGreaterThan(2.9);
  });
});

describe("computeFieldStrength", () => {
  it("returns 0.5 when range is zero", () => {
    expect(computeFieldStrength(3.0, 3.0, 3.0)).toBe(0.5);
  });

  it("returns 0 when avg equals skillMin", () => {
    expect(computeFieldStrength(3.0, 4.0, 3.0)).toBe(0);
  });

  it("returns 1 when avg equals skillMax", () => {
    expect(computeFieldStrength(3.0, 4.0, 4.0)).toBe(1);
  });

  it("returns 0.5 for midpoint", () => {
    expect(computeFieldStrength(3.0, 4.0, 3.5)).toBe(0.5);
  });

  it("clamps to 0 when avg is below min", () => {
    expect(computeFieldStrength(3.0, 4.0, 2.5)).toBe(0);
  });

  it("clamps to 1 when avg exceeds max", () => {
    expect(computeFieldStrength(3.0, 4.0, 4.5)).toBe(1);
  });
});

describe("computeSandbaggerPct", () => {
  it("returns 0 for no players with ratings", () => {
    expect(computeSandbaggerPct([makePlayer(undefined)], 3.0, 4.0)).toBe(0);
  });

  it("returns 0 when range is zero", () => {
    expect(computeSandbaggerPct([makePlayer(3.0)], 3.0, 3.0)).toBe(0);
  });

  it("counts players in top 20% of bracket range", () => {
    // Range 3.0–4.0, threshold = 3.0 + 0.8 = 3.8
    const players = [
      makePlayer(3.9), // above threshold
      makePlayer(3.5), // below
      makePlayer(3.0), // below
      makePlayer(3.8), // at threshold
    ];
    // 2 out of 4 = 0.5
    expect(computeSandbaggerPct(players, 3.0, 4.0)).toBe(0.5);
  });

  it("returns 1 when all players are in top 20%", () => {
    const players = [makePlayer(3.9), makePlayer(3.85)];
    expect(computeSandbaggerPct(players, 3.0, 4.0)).toBe(1);
  });

  it("returns 0 when no players are in top 20%", () => {
    const players = [makePlayer(3.0), makePlayer(3.2)];
    expect(computeSandbaggerPct(players, 3.0, 4.0)).toBe(0);
  });
});
