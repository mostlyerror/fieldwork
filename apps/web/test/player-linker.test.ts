import { describe, it, expect } from "vitest";
import { normalizeName, nameMatches } from "@/lib/player-linker";

describe("normalizeName", () => {
  it("lowercases", () => {
    expect(normalizeName("Ben Poon")).toBe("ben poon");
  });

  it("trims and collapses whitespace", () => {
    expect(normalizeName("  Ben   Poon  ")).toBe("ben poon");
  });

  it("strips diacritics", () => {
    expect(normalizeName("José Núñez")).toBe("jose nunez");
  });
});

describe("nameMatches", () => {
  describe("exact full name", () => {
    it("matches case-insensitive identical names", () => {
      expect(nameMatches("Ben Poon", "Ben Poon")).toBe(true);
      expect(nameMatches("ben poon", "BEN POON")).toBe(true);
    });

    it("matches with diacritics on either side", () => {
      expect(nameMatches("Jose Nunez", "José Núñez")).toBe(true);
    });
  });

  describe("first name only", () => {
    it("matches when input is just the first name and candidate has the same first name", () => {
      expect(nameMatches("Ben", "Ben Poon")).toBe(true);
      expect(nameMatches("Ben", "Ben Smith")).toBe(true);
    });

    it("does NOT match different first names", () => {
      expect(nameMatches("Ben", "Benjamin Poon")).toBe(false);
    });

    it("does NOT match when input first name is a prefix of candidate first name", () => {
      expect(nameMatches("Ben", "Benjamin")).toBe(false);
    });
  });

  describe("first + last initial", () => {
    it("matches with a single-letter last token", () => {
      expect(nameMatches("Ben P", "Ben Poon")).toBe(true);
    });

    it("matches with a period after initial", () => {
      expect(nameMatches("Ben P.", "Ben Poon")).toBe(true);
    });

    it("does NOT match if initial doesn't match", () => {
      expect(nameMatches("Ben S", "Ben Poon")).toBe(false);
    });
  });

  describe("first + last name prefix", () => {
    it("matches when input last name is a prefix of candidate last name", () => {
      expect(nameMatches("Ben Po", "Ben Poon")).toBe(true);
    });
  });

  describe("multiple tokens", () => {
    it("handles middle names", () => {
      expect(nameMatches("Ben Poon", "Ben C Poon")).toBe(true);
    });

    it("matches multi-token input against multi-token candidate", () => {
      expect(nameMatches("Ben C Poon", "Ben C Poon")).toBe(true);
    });
  });

  describe("non-matches", () => {
    it("doesn't match when first names differ", () => {
      expect(nameMatches("Ben Poon", "Bob Poon")).toBe(false);
    });

    it("doesn't match empty input", () => {
      expect(nameMatches("", "Ben Poon")).toBe(false);
    });

    it("doesn't match empty candidate", () => {
      expect(nameMatches("Ben", "")).toBe(false);
    });
  });
});
