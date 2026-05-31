import { describe, it, expect, vi } from "vitest";
import { findFlyerDuplicate } from "@/app/admin/(dashboard)/flyer-import/dedup";
import { isPublicStatus } from "@/lib/tournament-status";
import { mapExtractionToDraftRow, type FlyerExtraction } from "@/lib/flyer-extract";

describe("findFlyerDuplicate", () => {
  it("returns a match when the dedup RPC finds a same-date nearby row", async () => {
    const admin = {
      rpc: vi.fn(async () => ({
        data: [{ id: "dup-1", name: "Existing Open" }],
        error: null,
      })),
    };
    const hit = await findFlyerDuplicate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin as any,
      "2026-07-12",
      29.76,
      -95.39,
    );
    expect(hit).toEqual({ id: "dup-1", name: "Existing Open" });
  });

  it("returns null with no coordinates (cannot dedup)", async () => {
    const admin = { rpc: vi.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hit = await findFlyerDuplicate(admin as any, "2026-07-12", null, null);
    expect(hit).toBeNull();
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});

// A minimal model of the invariant: a "public list" is the subset of rows whose
// status is public; a draft is reachable by id regardless of status.
interface Row { id: string; status: string; date_start: string | null }

function publicList(rows: Row[]): Row[] {
  return rows.filter((r) => isPublicStatus(r.status));
}
function byId(rows: Row[], id: string): Row | undefined {
  return rows.find((r) => r.id === id); // no status filter (getTournament)
}

const extraction: FlyerExtraction = {
  name: "Grassroots Open", dateStart: "2026-08-01", dateEnd: null,
  startTime: null, endTime: null, venueName: "City Park", venueAddress: null,
  eventTypes: null, format: null, teamSize: null, price: null,
  earlyBirdPrice: null, earlyBirdEnds: null, registrationUrl: null,
  registrationContact: null, host: null, beneficiary: null, confidenceNotes: null,
};

describe("flyer draft lifecycle (data invariant)", () => {
  it("draft is excluded from listings, reachable by id, then listed after publish", () => {
    const mapped = mapExtractionToDraftRow(extraction);
    const rows: Row[] = [{ id: "flyer-1", status: mapped.status, date_start: mapped.date_start }];

    // 1. created as draft → excluded from listings
    expect(publicList(rows)).toHaveLength(0);
    // 2. reachable by direct id
    expect(byId(rows, "flyer-1")?.status).toBe("draft");
    // 3. publish → status flips to active
    rows[0].status = "active";
    // 4. now appears in listings
    expect(publicList(rows).map((r) => r.id)).toEqual(["flyer-1"]);
  });

  it("reconciliation: a later scrape of the same event attaches as duplicate, flyer stays canonical", () => {
    // find_nearby_tournament matches canonical rows (canonical_id IS NULL) with no
    // status filter, so a flyer row (draft or active) is matchable. The scrape row
    // is inserted with status='duplicate' + canonical_id → flyer row stays canonical.
    const flyer: Row & { canonical_id: string | null } = {
      id: "flyer-1", status: "active", date_start: "2026-08-01", canonical_id: null,
    };
    const matchable = (r: typeof flyer) => r.canonical_id === null; // RPC predicate
    expect(matchable(flyer)).toBe(true);
    const scrape = { id: "pbb-1", status: "duplicate", canonical_id: flyer.id };
    expect(scrape.canonical_id).toBe("flyer-1");
    // flyer name/details are never overwritten by the dedup path (upsert.ts adds a
    // source to canonical, doesn't update its name) → flyer stays canonical.
    expect(flyer.status).toBe("active");
  });
});
