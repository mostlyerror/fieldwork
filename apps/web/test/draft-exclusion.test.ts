import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the .eq() filters each query applies so we can assert status=active.
const filters: Array<[string, unknown]> = [];

function makeQuery(rows: unknown[]) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  q.select = vi.fn(chain);
  q.eq = vi.fn((col: string, val: unknown) => {
    filters.push([col, val]);
    return q;
  });
  q.gte = vi.fn(chain);
  q.order = vi.fn(() => Promise.resolve({ data: rows, error: null }));
  q.in = vi.fn(chain);
  q.not = vi.fn(chain);
  // thenable so `await query` resolves for queries that don't end in .order()
  q.then = (res: (v: { data: unknown[]; error: null }) => void) =>
    res({ data: rows, error: null });
  return q;
}

const activeRow = { id: "active-1", status: "active", date_end: "2999-01-01" };

vi.mock("@/lib/supabase", () => ({
  supabase: {
    // city listing path
    rpc: vi.fn(() => Promise.resolve({ data: [activeRow], error: null })),
    // venue + sitemap + getTournaments path
    from: vi.fn(() => makeQuery([activeRow])),
  },
}));

beforeEach(() => {
  filters.length = 0;
});

describe("public reads exclude drafts", () => {
  it("getTournaments filters status=active", async () => {
    const { getTournaments } = await import("@/lib/queries");
    await getTournaments();
    expect(filters).toContainEqual(["status", "active"]);
  });

  it("getVenueTournaments filters status=active", async () => {
    const { getVenueTournaments } = await import("@/lib/queries");
    await getVenueTournaments("venue-1");
    expect(filters).toContainEqual(["status", "active"]);
  });

  it("getVenuesForSitemap filters tournaments.status=active", async () => {
    const { getVenuesForSitemap } = await import("@/lib/queries");
    await getVenuesForSitemap();
    expect(filters).toContainEqual(["tournaments.status", "active"]);
  });
});
