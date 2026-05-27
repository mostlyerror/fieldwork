import { describe, it, expect } from "vitest";
import { winProbability, formatProbability } from "@/lib/predictions";

describe("winProbability", () => {
  it("returns 0.5 for equal ratings", () => {
    expect(winProbability(3.0, 3.0)).toBe(0.5);
  });

  it("favors the higher-rated team", () => {
    const p = winProbability(3.5, 3.0);
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(1);
  });

  it("is symmetric (p1 + p2 = 1)", () => {
    const p1 = winProbability(3.5, 3.0);
    const p2 = winProbability(3.0, 3.5);
    expect(p1 + p2).toBeCloseTo(1);
  });

  it("large rating gap gives strong favorite", () => {
    const p = winProbability(4.5, 2.5);
    expect(p).toBeGreaterThan(0.9);
  });

  it("small rating gap is close to 50/50", () => {
    const p = winProbability(3.1, 3.0);
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(0.6);
  });
});

describe("formatProbability", () => {
  it("formats 0.5 as 50%", () => {
    expect(formatProbability(0.5)).toBe("50%");
  });

  it("rounds to nearest integer", () => {
    expect(formatProbability(0.666)).toBe("67%");
  });

  it("formats 1.0 as 100%", () => {
    expect(formatProbability(1)).toBe("100%");
  });
});
