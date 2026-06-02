import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  AdminTournamentsView,
  type AdminTournamentRow,
} from "@/components/admin-tournaments-table";

const DAY_MS = 86_400_000;

/** Raw columns we read off the tournaments row (no fabricated fields). */
interface RawTournament {
  id: string;
  name: string;
  date_start: string | null;
  date_end: string | null;
  location_name: string | null;
  location_address: string | null;
  status: string | null;
  source_platform: string | null;
  source_url: string | null;
  latitude: number | null;
  longitude: number | null;
  entry_fee: number | null;
  created_at: string;
}

/** Calendar-day diff from today (negative = past). */
function daysFromToday(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / DAY_MS);
}

/**
 * Classify a tournament against the data-quality dimensions the cockpit
 * filters on. Everything here is derived from real columns — no invented data.
 */
function classify(t: RawTournament): AdminTournamentRow {
  const status = t.status ?? "active";
  // Archived = deliberately retired. A terminal state — exempt from every
  // data-quality / attention dimension (it's intentionally off public surfaces).
  const archived = status === "archived";
  const hasCoords = t.latitude != null && t.longitude != null;
  const pending = !archived && (status === "pending_review" || status === "draft");
  const isDuplicate = status === "duplicate";

  // Missing-data signals (date / fee / venue) — not flagged once archived.
  const missing: string[] = [];
  if (!archived) {
    if (!t.date_start) missing.push("No date");
    if (t.entry_fee == null) missing.push("No fee");
    if (!t.location_name?.trim()) missing.push("No venue");
  }

  // Stale: an active tournament that ended >30 days ago and hasn't been archived
  // yet. The scraper auto-archives these each run; this flag catches stragglers.
  const endRef = t.date_end ?? t.date_start;
  const endedLongAgo = endRef ? daysFromToday(endRef) < -30 : false;
  const stale = status === "active" && endedLongAgo;

  const noGeo = !hasCoords && !isDuplicate && !archived;
  const hasMissing = missing.length > 0;

  const needsAttention =
    !archived && (pending || noGeo || hasMissing || isDuplicate || stale);

  return {
    id: t.id,
    name: t.name,
    date_start: t.date_start,
    date_end: t.date_end,
    location_name: t.location_name,
    status,
    source_platform: t.source_platform,
    source_url: t.source_url,
    entry_fee: t.entry_fee,
    created_at: t.created_at,
    hasCoords,
    pending,
    isDuplicate,
    stale,
    noGeo,
    archived,
    missing,
    needsAttention,
  };
}

export default async function AllTournamentsPage() {
  const { data } = await getSupabaseAdmin()
    .from("tournaments")
    .select(
      "id, name, date_start, date_end, location_name, location_address, status, source_platform, source_url, latitude, longitude, entry_fee, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(400);

  const rows = ((data ?? []) as RawTournament[]).map(classify);

  return <AdminTournamentsView rows={rows} />;
}
