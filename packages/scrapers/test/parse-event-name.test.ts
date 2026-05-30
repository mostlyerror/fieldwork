import { describe, it, expect } from "vitest";
import { parseEventName } from "../src/utils/parse-event-name.js";

describe("parseEventName — existing formats", () => {
  it("parses a dash range", () => {
    const r = parseEventName("Men's Doubles 3.0-3.5");
    expect(r).toMatchObject({ gender: "men", eventType: "doubles", skillMin: 3.0, skillMax: 3.5 });
  });

  it("parses an open-ended plus", () => {
    const r = parseEventName("Mixed Doubles 4.0+");
    expect(r).toMatchObject({ gender: "mixed", eventType: "doubles", skillMin: 4.0, skillMax: null });
  });

  it("parses a single level", () => {
    const r = parseEventName("Women's Singles 3.5");
    expect(r).toMatchObject({ gender: "women", eventType: "singles", skillMin: 3.5, skillMax: 3.5 });
  });

  it("parses an en-dash range", () => {
    const r = parseEventName("Open Singles 4.5–5.0");
    expect(r).toMatchObject({ gender: "open", eventType: "singles", skillMin: 4.5, skillMax: 5.0 });
  });

  it("parses a slash range", () => {
    const r = parseEventName("Senior Doubles 2.5/3.0");
    expect(r).toMatchObject({ skillMin: 2.5, skillMax: 3.0 });
  });
});

describe("parseEventName — PickleballBrackets 'Skill: (...)' formats", () => {
  it("parses a 'X To Y' range and does NOT collapse to a single level", () => {
    const r = parseEventName("Coed Singles Skill: (3.500 To 4.499) Age: (18 And Above)");
    expect(r).toMatchObject({ gender: "open", eventType: "singles", skillMin: 3.5, skillMax: 4.499 });
  });

  it("parses 'X And Under' as a ceiling (no floor)", () => {
    const r = parseEventName("Coed Singles Skill: (3.499 And Under) Age: (18 And Above)");
    expect(r).toMatchObject({ gender: "open", eventType: "singles", skillMin: null, skillMax: 3.499 });
  });

  it("parses 'X And Above' as a floor (no ceiling)", () => {
    const r = parseEventName("Coed Doubles Skill: (4.000 And Above) Age: (13 And Above)");
    expect(r).toMatchObject({ gender: "open", eventType: "doubles", skillMin: 4.0, skillMax: null });
  });

  it("never reads the Age clause as a skill bound", () => {
    // Age "(13 And Above)" must not leak into skill; skill is the To-range.
    const r = parseEventName("Coed Singles Skill: (3.500 To 4.499) Age: (13 And Above)");
    expect(r.skillMin).toBe(3.5);
    expect(r.skillMax).toBe(4.499);
  });

  it("parses a single level inside the Skill clause", () => {
    const r = parseEventName("Coed Singles Skill: (3.500) Age: (18 And Above)");
    expect(r).toMatchObject({ skillMin: 3.5, skillMax: 3.5 });
  });
});
