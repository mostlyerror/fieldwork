import { describe, it, expect } from "vitest";
import { nextBracketKey } from "@/lib/selected-bracket-logic";

describe("nextBracketKey", () => {
  const keys = ["mens-40", "womens-35"];

  it("adopts the shared selection when Bracket & Results has that event", () => {
    expect(nextBracketKey("womens-35", keys, "mens-40")).toBe("womens-35");
  });

  it("keeps the current tab when the shared selection is an FI-only event", () => {
    expect(nextBracketKey("seniors-30", keys, "mens-40")).toBe("mens-40");
  });

  it("keeps the current tab when nothing is selected yet", () => {
    expect(nextBracketKey(null, keys, "mens-40")).toBe("mens-40");
  });

  it("keeps the current tab when the selection is already the current one", () => {
    expect(nextBracketKey("mens-40", keys, "mens-40")).toBe("mens-40");
  });
});
