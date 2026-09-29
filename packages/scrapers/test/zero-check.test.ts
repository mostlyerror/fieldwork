import { describe, it, expect } from "vitest";
import { isSuspiciousZero, median } from "../src/utils/zero-check.js";

describe("median", () => {
  it("returns 0 for no values", () => {
    expect(median([])).toBe(0);
  });

  it("takes the middle value of an odd list", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("averages the two middle values of an even list", () => {
    expect(median([0, 0, 4, 6])).toBe(2);
  });
});

describe("isSuspiciousZero", () => {
  it("flags 0 found when the source usually finds tournaments", () => {
    expect(isSuspiciousZero(0, [42, 40, 41, 39, 44])).toBe(true);
  });

  it("never flags a run that found something", () => {
    expect(isSuspiciousZero(3, [42, 40, 41])).toBe(false);
  });

  it("does not flag a source that usually finds nothing", () => {
    expect(isSuspiciousZero(0, [0, 0, 0, 2, 0])).toBe(false);
  });

  it("does not flag a brand new source with no history", () => {
    expect(isSuspiciousZero(0, [])).toBe(false);
  });

  it("only looks at the last 10 runs", () => {
    // Newest 10 are all 0; older runs found plenty.
    const recent = [...Array(10).fill(0), 50, 50, 50, 50, 50];
    expect(isSuspiciousZero(0, recent)).toBe(false);
  });
});
