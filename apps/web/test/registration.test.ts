import { describe, it, expect } from "vitest";
import { getRegistrationStatus, formatUrgency, urgencyTier } from "@/lib/registration";
import type { Tournament } from "@/lib/types";

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: "t1",
    name: "Test Tournament",
    date_start: "2026-06-01",
    date_end: "2026-06-02",
    location_name: "Venue",
    location_address: null,
    latitude: null,
    longitude: null,
    skill_levels: null,
    format: null,
    entry_fee: null,
    registration_url: null,
    registration_status: null,
    registration_close_date: null,
    logo_url: null,
    venue_website: null,
    description: null,
    status: "active",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("getRegistrationStatus", () => {
  it("uses registration_close_date when provided", () => {
    const t = makeTournament({ registration_close_date: "2026-05-30T10:00:00Z" });
    const now = new Date("2026-05-27T10:00:00Z");
    const status = getRegistrationStatus(t, now);
    expect(status.hasExplicitClose).toBe(true);
    expect(status.isClosed).toBe(false);
    expect(status.msUntil).toBeGreaterThan(0);
  });

  it("falls back to date_start when close date is null", () => {
    const t = makeTournament({ date_start: "2026-06-01", registration_close_date: null });
    const now = new Date("2026-05-27T10:00:00Z");
    const status = getRegistrationStatus(t, now);
    expect(status.hasExplicitClose).toBe(false);
    expect(status.isClosed).toBe(false);
  });

  it("marks as closed when deadline has passed", () => {
    const t = makeTournament({ registration_close_date: "2026-05-20T10:00:00Z" });
    const now = new Date("2026-05-27T10:00:00Z");
    const status = getRegistrationStatus(t, now);
    expect(status.isClosed).toBe(true);
    expect(status.msUntil).toBeLessThan(0);
  });

  it("respects registration_status: closed even if deadline is in the future", () => {
    const t = makeTournament({
      registration_close_date: "2026-06-30T10:00:00Z",
      registration_status: "closed",
    });
    const status = getRegistrationStatus(t, new Date("2026-05-27T10:00:00Z"));
    expect(status.isClosed).toBe(true);
  });
});

describe("urgencyTier", () => {
  const HOUR = 60 * 60 * 1000;

  it("returns 'closed' when isClosed is true", () => {
    expect(urgencyTier(HOUR, true)).toBe("closed");
  });

  it("returns 'urgent' when less than 24h remain", () => {
    expect(urgencyTier(23 * HOUR, false)).toBe("urgent");
    expect(urgencyTier(HOUR, false)).toBe("urgent");
  });

  it("returns 'soon' when less than 7 days remain", () => {
    expect(urgencyTier(25 * HOUR, false)).toBe("soon");
    expect(urgencyTier(6 * 24 * HOUR, false)).toBe("soon");
  });

  it("returns 'normal' when more than 7 days remain", () => {
    expect(urgencyTier(8 * 24 * HOUR, false)).toBe("normal");
  });
});

describe("formatUrgency", () => {
  const HOUR = 60 * 60 * 1000;

  it("returns null when past", () => {
    expect(formatUrgency(-1000)).toBeNull();
  });

  it("formats minutes when less than an hour", () => {
    expect(formatUrgency(30 * 60 * 1000)).toBe("Closes in 30 min");
  });

  it("formats hours when less than a day", () => {
    expect(formatUrgency(5 * HOUR)).toBe("Closes in 5h");
  });

  it("formats days when more than 24h", () => {
    expect(formatUrgency(3 * 24 * HOUR)).toBe("Closes in 3 days");
  });

  it("uses singular 'day' for 1 day", () => {
    expect(formatUrgency(25 * HOUR)).toBe("Closes in 2 days");
    expect(formatUrgency(20 * HOUR)).toBe("Closes in 20h");
  });
});
