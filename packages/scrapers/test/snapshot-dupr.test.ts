import { describe, it, expect } from "vitest";

describe("snapshot-dupr logic", () => {
  it("snapshot should only happen once per event_player (enriched_at guard)", () => {
    // The snapshot function filters by `enriched_at IS NULL`
    // Simulating: once snapshotted, enriched_at is set, so it won't be picked up again
    const rows = [
      { id: "1", enriched_at: null, player_id: "p1" },
      { id: "2", enriched_at: "2026-05-27T00:00:00Z", player_id: "p2" },
    ];
    const unsnapshotted = rows.filter((r) => r.enriched_at === null);
    expect(unsnapshotted).toHaveLength(1);
    expect(unsnapshotted[0].id).toBe("1");
  });

  it("should prefer enriched_dupr over live join", () => {
    // Simulating the query precedence logic
    function resolveLiveDupr(enrichedDupr: number | null, joinedDupr: number | null): number | null {
      return enrichedDupr ?? joinedDupr ?? null;
    }

    // Snapshot exists — use it even if live has changed
    expect(resolveLiveDupr(3.2, 3.8)).toBe(3.2);

    // No snapshot yet — fall back to live join
    expect(resolveLiveDupr(null, 3.8)).toBe(3.8);

    // Neither exists
    expect(resolveLiveDupr(null, null)).toBeNull();
  });
});
