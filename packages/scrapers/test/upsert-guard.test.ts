import { describe, it, expect } from "vitest";
import { isDestructiveEventReplace } from "../src/utils/roster-guard.js";

describe("isDestructiveEventReplace", () => {
  it("blocks replacing a populated roster with an empty scrape", () => {
    expect(isDestructiveEventReplace(0, 10)).toBe(true);
  });

  it("allows a normal refresh that found players", () => {
    expect(isDestructiveEventReplace(8, 10)).toBe(false);
    expect(isDestructiveEventReplace(12, 10)).toBe(false);
  });

  it("allows the first-ever ingest (nothing to lose)", () => {
    expect(isDestructiveEventReplace(0, 0)).toBe(false);
    expect(isDestructiveEventReplace(5, 0)).toBe(false);
  });
});
