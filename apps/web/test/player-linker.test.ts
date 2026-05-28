import { describe, it, expect } from "vitest";
import { normalizeName } from "@/lib/player-linker";

describe("normalizeName", () => {
  it("lowercases", () => {
    expect(normalizeName("Ben Poon")).toBe("ben poon");
  });

  it("trims whitespace", () => {
    expect(normalizeName("  Ben Poon  ")).toBe("ben poon");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeName("Ben   Poon")).toBe("ben poon");
  });

  it("strips diacritics", () => {
    expect(normalizeName("José Núñez")).toBe("jose nunez");
  });

  it("treats different casings as equal", () => {
    expect(normalizeName("BEN POON")).toBe(normalizeName("ben poon"));
  });

  it("does not match similar but different names", () => {
    expect(normalizeName("Ben Poon")).not.toBe(normalizeName("Benjamin Poon"));
  });
});
