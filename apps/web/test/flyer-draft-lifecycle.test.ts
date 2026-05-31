import { describe, it, expect, vi } from "vitest";
import { findFlyerDuplicate } from "@/app/admin/(dashboard)/flyer-import/dedup";

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
