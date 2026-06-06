import { supabase } from "./supabase.js";

/** How much of the player base has a real DUPR rating — progress at a glance. */
export interface DuprCoverage {
  total: number;
  rated: number; // has a doubles or singles rating
  verified: number; // DUPR-verified
  pct: number; // rated / total, 0-100
}

export async function getDuprCoverage(): Promise<DuprCoverage> {
  const head = { count: "exact" as const, head: true };
  const [{ count: total }, { count: rated }, { count: verified }] = await Promise.all([
    supabase.from("players").select("id", head),
    supabase.from("players").select("id", head).or("dupr_doubles.not.is.null,dupr_singles.not.is.null"),
    supabase.from("players").select("id", head).eq("dupr_verified", true),
  ]);
  const t = total ?? 0;
  const r = rated ?? 0;
  return { total: t, rated: r, verified: verified ?? 0, pct: t ? Math.round((r / t) * 100) : 0 };
}

/** "1,120 players · 1,116 rated (100%) · 304 verified (27%)" */
export function formatCoverage(c: DuprCoverage): string {
  const vpct = c.total ? Math.round((c.verified / c.total) * 100) : 0;
  return `${c.total.toLocaleString()} players · ${c.rated.toLocaleString()} rated (${c.pct}%) · ${c.verified.toLocaleString()} verified (${vpct}%)`;
}
