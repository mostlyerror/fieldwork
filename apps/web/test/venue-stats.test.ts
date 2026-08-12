import { describe, it, expect } from "vitest";
import {
  shortCity,
  shortDate,
  buildVenueCards,
  cadenceLine,
  venueOgLine,
} from "@/lib/venue-stats";

const venue = (id: string, name: string, extra: Partial<{ photo_url: string | null; formatted_address: string | null }> = {}) => ({
  id,
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  photo_url: extra.photo_url ?? null,
  formatted_address: extra.formatted_address ?? null,
});

const t = (venue_id: string, date_start: string, date_end: string | null = null) => ({
  venue_id,
  date_start,
  date_end,
});

describe("shortCity", () => {
  it("extracts 'City, ST' from a Google formatted_address", () => {
    expect(shortCity("1331 Hwy 6, Sugar Land, TX 77478, USA")).toBe("Sugar Land, TX");
  });
  it("handles addresses without a street part", () => {
    expect(shortCity("Katy, TX 77449, USA")).toBe("Katy, TX");
  });
  it("returns null for null or unparseable input", () => {
    expect(shortCity(null)).toBeNull();
    expect(shortCity("Texas")).toBeNull();
  });
});

describe("shortDate", () => {
  it("formats an ISO date as 'Mon D'", () => {
    expect(shortDate("2026-08-12")).toBe("Aug 12");
  });
});

describe("buildVenueCards", () => {
  const today = "2026-08-11";
  const venues = [venue("a", "Quiet Club"), venue("b", "Busy Club"), venue("c", "No Tournaments Club")];
  const tournaments = [
    t("a", "2026-05-01"),
    t("b", "2026-06-01"),
    t("b", "2026-07-01", "2026-07-02"),
    t("b", "2026-08-15"),
    t("b", "2026-09-01"),
  ];

  it("aggregates totals, upcoming count, and next date per venue", () => {
    const cards = buildVenueCards(venues, tournaments, today);
    const busy = cards.find((c) => c.id === "b")!;
    expect(busy.total).toBe(4);
    expect(busy.upcomingCount).toBe(2);
    expect(busy.nextDate).toBe("2026-08-15");
  });

  it("treats a tournament still running today (date_end >= today) as upcoming", () => {
    const cards = buildVenueCards([venue("x", "Live")], [t("x", "2026-08-10", "2026-08-11")], today);
    expect(cards[0].upcomingCount).toBe(1);
    expect(cards[0].nextDate).toBe("2026-08-10");
  });

  it("sorts by upcoming desc, then total desc, then name asc", () => {
    const cards = buildVenueCards(venues, tournaments, today);
    expect(cards.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("drops venues with zero linked tournaments", () => {
    const cards = buildVenueCards(venues, tournaments, today);
    expect(cards.find((c) => c.id === "c")).toBeUndefined();
  });

  it("keeps venues without photos (photoUrl null)", () => {
    const cards = buildVenueCards(venues, tournaments, today);
    expect(cards.find((c) => c.id === "a")!.photoUrl).toBeNull();
  });
});

describe("cadenceLine", () => {
  it("shows upcoming when present", () => {
    expect(cadenceLine({ total: 9, upcomingCount: 4 })).toBe("9 tournaments · 4 upcoming");
  });
  it("falls back to hosted-only copy", () => {
    expect(cadenceLine({ total: 2, upcomingCount: 0 })).toBe("2 tournaments hosted");
  });
  it("singularizes", () => {
    expect(cadenceLine({ total: 1, upcomingCount: 0 })).toBe("1 tournament hosted");
  });
});

describe("venueOgLine", () => {
  it("includes next date when present", () => {
    expect(venueOgLine(9, "2026-08-12")).toBe("9 tournaments hosted · Next on Aug 12");
  });
  it("omits next date when null", () => {
    expect(venueOgLine(2, null)).toBe("2 tournaments hosted");
  });
});
