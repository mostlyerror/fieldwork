import { describe, it, expect } from "vitest";
import { buildShareUrl } from "@/lib/share-url";

describe("buildShareUrl", () => {
  it("appends utm params to a clean url", () => {
    const out = buildShareUrl("https://pickleradar.app/tournaments/abc", {
      medium: "copy_link",
      campaign: "tournament",
      content: "abc",
    });
    const u = new URL(out);
    expect(u.origin + u.pathname).toBe("https://pickleradar.app/tournaments/abc");
    expect(u.searchParams.get("utm_source")).toBe("share");
    expect(u.searchParams.get("utm_medium")).toBe("copy_link");
    expect(u.searchParams.get("utm_campaign")).toBe("tournament");
    expect(u.searchParams.get("utm_content")).toBe("abc");
  });

  it("preserves existing non-utm query params (e.g. filters)", () => {
    const out = buildShareUrl("https://pickleradar.app/houston/tournaments?level=3.5", {
      medium: "native_share",
      campaign: "tournament",
    });
    const u = new URL(out);
    expect(u.searchParams.get("level")).toBe("3.5");
    expect(u.searchParams.get("utm_medium")).toBe("native_share");
  });

  it("strips inbound utm params so attribution does not propagate through re-shares", () => {
    const out = buildShareUrl(
      "https://pickleradar.app/tournaments/abc?utm_source=share&utm_medium=copy_text&utm_content=old",
      { medium: "result_card_link", campaign: "result_card", content: "new" },
    );
    const u = new URL(out);
    // The stale inbound attribution must be overwritten with the fresh share's values.
    expect(u.searchParams.get("utm_medium")).toBe("result_card_link");
    expect(u.searchParams.get("utm_campaign")).toBe("result_card");
    expect(u.searchParams.get("utm_content")).toBe("new");
    // Exactly one of each utm param — no duplicates from the inbound link.
    expect(u.searchParams.getAll("utm_medium")).toHaveLength(1);
    expect(u.searchParams.getAll("utm_content")).toHaveLength(1);
  });

  it("omits utm_content when no entity id is supplied", () => {
    const out = buildShareUrl("https://pickleradar.app/houston/tournaments", {
      medium: "copy_link",
      campaign: "tournament",
    });
    const u = new URL(out);
    expect(u.searchParams.has("utm_content")).toBe(false);
  });

  it("returns the original string unchanged if the url cannot be parsed", () => {
    const out = buildShareUrl("not-a-url", {
      medium: "copy_link",
      campaign: "tournament",
    });
    expect(out).toBe("not-a-url");
  });
});
