import { describe, it, expect } from "vitest";
import { localDateString } from "../src/utils/local-date.js";

describe("localDateString", () => {
  it("stays on the local date during a Central evening (CDT, UTC-5)", () => {
    // 9:16 PM CDT Jun 10 = 02:16 UTC Jun 11 — the nightly scrape window that
    // made one-day tournaments invisible to UTC-dated jobs.
    expect(localDateString(new Date("2026-06-11T02:16:00Z"))).toBe("2026-06-10");
  });

  it("matches UTC during the Central daytime", () => {
    // 9:00 AM CDT Jun 10 = 14:00 UTC Jun 10
    expect(localDateString(new Date("2026-06-10T14:00:00Z"))).toBe("2026-06-10");
  });

  it("handles winter time (CST, UTC-6)", () => {
    // 8:00 PM CST Jan 14 = 02:00 UTC Jan 15
    expect(localDateString(new Date("2026-01-15T02:00:00Z"))).toBe("2026-01-14");
  });

  it("flips to the next local date after local midnight", () => {
    // 12:30 AM CDT Jun 11 = 05:30 UTC Jun 11
    expect(localDateString(new Date("2026-06-11T05:30:00Z"))).toBe("2026-06-11");
  });
});
