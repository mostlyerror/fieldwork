import { describe, it, expect } from "vitest";
import { TOURNAMENT_STATUS, isPublicStatus } from "@/lib/tournament-status";

describe("tournament-status", () => {
  it("exposes the draft and active status literals", () => {
    expect(TOURNAMENT_STATUS.DRAFT).toBe("draft");
    expect(TOURNAMENT_STATUS.ACTIVE).toBe("active");
  });

  it("treats only active as public", () => {
    expect(isPublicStatus("active")).toBe(true);
    expect(isPublicStatus("draft")).toBe(false);
    expect(isPublicStatus("duplicate")).toBe(false);
  });
});
