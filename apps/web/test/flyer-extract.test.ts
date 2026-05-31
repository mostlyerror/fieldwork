import { describe, it, expect, vi } from "vitest";
import {
  mapExtractionToDraftRow,
  extractFlyer,
  type FlyerExtraction,
  type FlyerLlmClient,
} from "@/lib/flyer-extract";

const full: FlyerExtraction = {
  name: "Bayou City Open",
  dateStart: "2026-07-12",
  dateEnd: "2026-07-13",
  startTime: "8:00 AM",
  endTime: "5:00 PM",
  venueName: "Memorial Park Courts",
  venueAddress: "6501 Memorial Dr, Houston, TX",
  eventTypes: ["Mixed Doubles", "Men's Doubles"],
  format: "double_elim",
  teamSize: 2,
  price: 60,
  earlyBirdPrice: 50,
  earlyBirdEnds: "2026-06-30",
  registrationUrl: "https://example.com/reg",
  registrationContact: "td@example.com",
  host: "Bayou City Pickleball",
  beneficiary: null,
  confidenceNotes: "Flyer and post disagree on end time.",
};

describe("mapExtractionToDraftRow", () => {
  it("maps extraction fields onto a draft tournaments row", () => {
    const row = mapExtractionToDraftRow(full);
    expect(row.name).toBe("Bayou City Open");
    expect(row.date_start).toBe("2026-07-12");
    expect(row.date_end).toBe("2026-07-13");
    expect(row.entry_fee).toBe(60);
    expect(row.registration_url).toBe("https://example.com/reg");
    expect(row.status).toBe("draft");
    expect(row.source_platform).toBe("flyer");
    expect(row.description).toContain("Bayou City Pickleball");
  });

  it("defaults date_end to date_start for a single-day event", () => {
    const row = mapExtractionToDraftRow({ ...full, dateEnd: null });
    expect(row.date_end).toBe("2026-07-12");
  });

  it("leaves date fields null when unparseable (never invents a date)", () => {
    const row = mapExtractionToDraftRow({ ...full, dateStart: null, dateEnd: null });
    expect(row.date_start).toBeNull();
    expect(row.date_end).toBeNull();
  });

  it("uses location placeholders so the row is insertable before venue confirm", () => {
    const row = mapExtractionToDraftRow({ ...full, venueName: null });
    expect(row.location_name).toBe("");
  });
});

describe("extractFlyer", () => {
  it("calls the injected client and returns parsed JSON", async () => {
    const client: FlyerLlmClient = vi.fn(async () => JSON.stringify(full));
    const result = await extractFlyer(
      { text: "post text", imageBase64: "BASE64", imageMediaType: "image/jpeg" },
      client,
    );
    expect(client).toHaveBeenCalledOnce();
    expect(result.name).toBe("Bayou City Open");
  });

  it("strips markdown fences before parsing", async () => {
    const client: FlyerLlmClient = vi.fn(
      async () => "```json\n" + JSON.stringify(full) + "\n```",
    );
    const result = await extractFlyer({ text: "x" }, client);
    expect(result.dateStart).toBe("2026-07-12");
  });

  it("throws a clear error when the model returns non-JSON", async () => {
    const client: FlyerLlmClient = vi.fn(async () => "not json");
    await expect(extractFlyer({ text: "x" }, client)).rejects.toThrow(
      /could not parse/i,
    );
  });
});
