"use client";

/**
 * AdminTournamentsView — the data-quality / inventory cockpit for the full
 * tournament catalog.
 *
 * Replaces the old plain table. The operator's job here is triage: find the
 * rows that need a fix (pending, no geocode, missing data, duplicates, stale)
 * and act on them inline. Health stat-tiles double as one-click filters; a
 * search + view segment + source filter narrow further.
 *
 * Responsive over ONE data source:
 *   • mobile (<lg): stat tiles + stacked per-tournament cards.
 *   • desktop (lg+): filter rail + health tiles bar + wide multi-column table.
 *
 * Every row action is real (reuses approveTournament / rejectTournament /
 * archiveTournament). No fabricated columns — registration counts don't live
 * on the tournament row, so they're intentionally omitted.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveTournament,
  rejectTournament,
  archiveTournament,
} from "@/app/admin/(dashboard)/actions";
import { useOptimisticAction } from "@/components/admin/use-optimistic-action";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AgeBadge } from "@/components/admin/age-badge";
import { formatCurrency } from "@/lib/format";
import { SOURCE_DISPLAY_NAMES } from "@/lib/constants";

/** Row pre-classified on the server. Derived flags only — no invented data. */
export interface AdminTournamentRow {
  id: string;
  name: string;
  date_start: string | null;
  date_end: string | null;
  location_name: string | null;
  status: string;
  source_platform: string | null;
  source_url: string | null;
  entry_fee: number | null;
  created_at: string;
  hasCoords: boolean;
  pending: boolean;
  isDuplicate: boolean;
  stale: boolean;
  noGeo: boolean;
  /** Deliberately retired — terminal state, off public surfaces. */
  archived: boolean;
  /** Human labels for missing fields, e.g. ["No date", "No fee"]. */
  missing: string[];
  needsAttention: boolean;
}

const DAY_MS = 86_400_000;

type ViewKey = "attention" | "all" | "healthy";
type QualityKey =
  | "pending"
  | "noGeo"
  | "missing"
  | "dupes"
  | "stale"
  | "archived"
  | null;

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "pickleballbrackets", label: "PickleballBrackets" },
  { value: "pickleball_den", label: "Pickleball Den" },
  { value: "manual", label: "Direct Link" },
];

function sourceLabel(platform: string | null): string {
  if (!platform) return "Direct Link";
  return SOURCE_DISPLAY_NAMES[platform] ?? platform;
}

/** Compact "When" string from real date columns. */
function formatWhen(start: string | null, end: string | null): {
  primary: string;
  year: string | null;
} {
  if (!start) return { primary: "—", year: "no date" };
  const s = new Date(start + "T00:00:00");
  const month = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (end && end !== start) {
    const e = new Date(end + "T00:00:00");
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return {
        primary: `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${e.getDate()}`,
        year: `${e.getFullYear()}`,
      };
    }
    return { primary: `${month(s)} – ${month(e)}`, year: `${e.getFullYear()}` };
  }
  return { primary: month(s), year: `${s.getFullYear()}` };
}

/** Status pill label/tone derived from the real status string. */
function statusPill(row: AdminTournamentRow): {
  label: string;
  tone: "active" | "pending" | "stale" | "dupe" | "archived";
} {
  if (row.archived) return { label: "Archived", tone: "archived" };
  if (row.pending) return { label: "Pending", tone: "pending" };
  if (row.isDuplicate) return { label: "Duplicate", tone: "dupe" };
  if (row.stale) return { label: "Stale", tone: "stale" };
  return { label: "Active", tone: "active" };
}

const STATUS_PILL_CLS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  pending: "bg-red-50 text-red-700",
  stale: "bg-amber-900/[0.06] text-amber-800",
  dupe: "bg-amber-50 text-amber-700",
  archived: "bg-slate-100 text-slate-500",
};
const STATUS_DOT_CLS: Record<string, string> = {
  active: "bg-emerald-500",
  pending: "bg-red-500",
  stale: "bg-amber-700",
  dupe: "bg-amber-500",
  archived: "bg-slate-400",
};

// ───────────────────────────────────────────────────────── main view

export function AdminTournamentsView({ rows }: { rows: AdminTournamentRow[] }) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewKey>("attention");
  const [quality, setQuality] = useState<QualityKey>(null);
  const [source, setSource] = useState("");
  const [showHealthy, setShowHealthy] = useState(false);

  const live = useMemo(
    () => rows.filter((r) => !removed.has(r.id)),
    [rows, removed]
  );

  // Catalog-wide counts (independent of the active filters).
  const counts = useMemo(() => {
    const c = {
      total: live.length,
      attention: 0,
      healthy: 0,
      pending: 0,
      active: 0,
      noGeo: 0,
      missing: 0,
      dupes: 0,
      stale: 0,
      archived: 0,
      geocoded: 0,
    };
    for (const r of live) {
      if (r.needsAttention) c.attention++;
      else if (!r.archived) c.healthy++;
      if (r.pending) c.pending++;
      if (r.status === "active") c.active++;
      if (r.noGeo) c.noGeo++;
      if (r.missing.length > 0) c.missing++;
      if (r.isDuplicate) c.dupes++;
      if (r.stale) c.stale++;
      if (r.archived) c.archived++;
      if (r.hasCoords) c.geocoded++;
    }
    return c;
  }, [live]);

  // Catalog health %: share of rows that are complete & geocoded.
  const health = (() => {
    // Archived rows are retired — exclude them from the data-quality score.
    const base = live.filter((r) => !r.archived);
    if (base.length === 0) return 100;
    const ok = base.filter(
      (r) => r.hasCoords && r.missing.length === 0 && !r.pending,
    ).length;
    return Math.round((ok / base.length) * 100);
  })();

  // Apply view + quality + source + search.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return live.filter((r) => {
      if (view === "attention" && !r.needsAttention) return false;
      if (view === "healthy" && (r.needsAttention || r.archived)) return false;
      if (quality === "pending" && !r.pending) return false;
      if (quality === "noGeo" && !r.noGeo) return false;
      if (quality === "missing" && r.missing.length === 0) return false;
      if (quality === "dupes" && !r.isDuplicate) return false;
      if (quality === "stale" && !r.stale) return false;
      if (quality === "archived" && !r.archived) return false;
      if (source) {
        const plat = r.source_platform ?? "manual";
        if (plat !== source) return false;
      }
      if (q) {
        const hay = `${r.name} ${r.location_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [live, view, quality, source, search]);

  // In the default "attention" view, healthy rows are collapsed behind a toggle.
  const attentionRows = filtered.filter((r) => r.needsAttention);
  const healthyHidden =
    view === "attention" && !showHealthy
      ? filtered.filter((r) => !r.needsAttention)
      : [];
  const visibleRows =
    view === "attention" && !showHealthy ? attentionRows : filtered;

  function remove(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
  }

  const sectionLabel =
    view === "attention"
      ? "Needs attention"
      : view === "healthy"
        ? "Healthy"
        : "All tournaments";

  return (
    <>
      {/* ── Header ── */}
      <AdminPageHeader
        title="All Tournaments"
        subtitle={`${counts.total} in catalog · ${counts.attention} need attention`}
        action={
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-full border border-emerald-900/10 bg-white px-3.5 py-2 text-[12.5px] font-bold text-emerald-900/40 shadow-sm"
              title="Export not yet wired"
            >
              Export CSV
            </button>
          </div>
        }
      />

      {/* ── Aging queue callout (only when there are pending submissions) ── */}
      {counts.pending > 0 && <PendingCallout count={counts.pending} />}

      {/* ── Health stat-tiles as filter bar (mobile 2-col, desktop 6-col) ── */}
      <div className="mb-3.5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[1.25fr_1fr_1fr_1fr_1fr_1.1fr]">
        <HealthTile health={health} />
        <StatTile
          label="Pending"
          value={counts.pending}
          meta="awaiting review"
          tone="red"
          active={quality === "pending"}
          onClick={() => toggleQuality("pending")}
        />
        <StatTile
          label="Active"
          value={counts.active}
          meta="live publicly"
          tone="green"
          active={view === "healthy"}
          onClick={() => setView((v) => (v === "healthy" ? "attention" : "healthy"))}
        />
        <StatTile
          label="No geocode"
          value={counts.noGeo}
          meta="won't map"
          tone="amber"
          active={quality === "noGeo"}
          onClick={() => toggleQuality("noGeo")}
        />
        <StatTile
          label="Missing data"
          value={counts.missing}
          meta="date / fee / venue"
          tone="amber"
          active={quality === "missing"}
          onClick={() => toggleQuality("missing")}
        />
        <StatTile
          label="Possible dupes"
          value={counts.dupes}
          meta="flagged duplicate"
          tone="blue"
          active={quality === "dupes"}
          onClick={() => toggleQuality("dupes")}
        />
      </div>

      {/* ── Body: desktop = rail + main; mobile = single column ── */}
      <div className="lg:grid lg:grid-cols-[228px_1fr] lg:items-start lg:gap-5">
        {/* Desktop filter rail */}
        <aside className="sticky top-[68px] hidden flex-col gap-3.5 lg:flex">
          <RailCard title="View">
            {(
              [
                ["attention", "Needs attention", counts.attention],
                ["all", "All tournaments", counts.total],
                ["healthy", "Healthy", counts.healthy],
              ] as [ViewKey, string, number][]
            ).map(([key, label, n]) => (
              <RailItem
                key={key}
                label={label}
                count={n}
                on={view === key}
                onClick={() => setView(key)}
              />
            ))}
          </RailCard>

          <RailCard title="Data quality">
            <RailItem
              dot="bg-red-500"
              label="Pending"
              count={counts.pending}
              on={quality === "pending"}
              onClick={() => toggleQuality("pending")}
            />
            <RailItem
              dot="bg-amber-500"
              label="No geocode"
              count={counts.noGeo}
              on={quality === "noGeo"}
              onClick={() => toggleQuality("noGeo")}
            />
            <RailItem
              dot="bg-amber-500"
              label="Missing data"
              count={counts.missing}
              on={quality === "missing"}
              onClick={() => toggleQuality("missing")}
            />
            <RailItem
              dot="bg-blue-500"
              label="Possible dupes"
              count={counts.dupes}
              on={quality === "dupes"}
              onClick={() => toggleQuality("dupes")}
            />
            <RailItem
              dot="bg-emerald-900/25"
              label="Stale / past"
              count={counts.stale}
              on={quality === "stale"}
              onClick={() => toggleQuality("stale")}
            />
            <RailItem
              dot="bg-slate-400"
              label="Archived"
              count={counts.archived}
              on={quality === "archived"}
              onClick={() => toggleQuality("archived")}
            />
          </RailCard>

          <RailCard title="Filters">
            <div className="px-1.5 pb-1.5">
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full cursor-pointer rounded-lg border border-emerald-900/10 bg-white px-3 py-2 text-[12.5px] font-semibold text-emerald-900/70 focus:border-emerald-400 focus:outline-none"
              >
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </RailCard>

          <RailCard title="Catalog health">
            <div className="px-3.5 pb-4 pt-1">
              <div className="text-[22px] font-extrabold leading-none tracking-tight text-emerald-950">
                {health}%
              </div>
              <div className="mt-1 text-[11px] font-medium text-emerald-900/45">
                complete &amp; geocoded
              </div>
              <Meter value={health} />
            </div>
          </RailCard>
        </aside>

        {/* Main column */}
        <main className="min-w-0">
          {/* Controls */}
          <div className="mb-3 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-2.5">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-900/30"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.2-3.2" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or venue…"
                className="h-11 w-full rounded-[10px] border border-emerald-900/10 bg-white pl-9 pr-3 text-[15px] text-emerald-950 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 lg:h-10 lg:text-[13px]"
              />
            </div>
            {/* View segment (desktop) */}
            <div className="hidden overflow-hidden rounded-[10px] border border-emerald-900/10 bg-white shadow-sm lg:flex">
              {(
                [
                  ["attention", "Needs attention"],
                  ["all", "All"],
                  ["healthy", "Healthy"],
                ] as [ViewKey, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={`px-3.5 py-2.5 text-[12px] font-semibold transition ${
                    view === key
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-emerald-900/45 hover:text-emerald-900/70"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Source filter (desktop top bar duplicate is in rail; keep mobile select) */}
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="h-11 cursor-pointer rounded-[10px] border border-emerald-900/10 bg-white px-3 text-[13px] font-semibold text-emerald-900/70 shadow-sm focus:border-emerald-400 focus:outline-none lg:hidden"
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Mobile-only view + quality filter pills */}
          <MobileFilterPills
            view={view}
            setView={setView}
            quality={quality}
            toggleQuality={toggleQuality}
            counts={counts}
          />

          {/* Section label */}
          <div className="mb-2 mt-4 flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-emerald-900/55">
              {sectionLabel}
            </span>
            <span className="rounded-full bg-emerald-900/[0.06] px-2 py-0.5 text-[11px] font-bold text-emerald-900/45">
              {visibleRows.length}
            </span>
            <span className="h-px flex-1 bg-emerald-900/10" />
          </div>

          {/* ── DESKTOP TABLE (lg+) ── */}
          <div className="hidden overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm lg:block">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-auto" />
                <col className="w-[118px]" />
                <col className="w-[190px]" />
                <col className="w-[104px]" />
                <col className="w-[120px]" />
                <col className="w-[150px]" />
                <col className="w-[200px]" />
                <col className="w-[78px]" />
                <col className="w-[176px]" />
              </colgroup>
              <thead>
                <tr className="bg-[#fcfcf6] text-left text-[10px] font-bold uppercase tracking-[0.07em] text-emerald-900/40">
                  <th className="border-b border-emerald-900/10 px-4 py-3">
                    Tournament
                  </th>
                  <th className="border-b border-emerald-900/10 px-4 py-3">When</th>
                  <th className="border-b border-emerald-900/10 px-4 py-3">Where</th>
                  <th className="border-b border-emerald-900/10 px-4 py-3">Status</th>
                  <th className="border-b border-emerald-900/10 px-4 py-3">Geocode</th>
                  <th className="border-b border-emerald-900/10 px-4 py-3">Source</th>
                  <th className="border-b border-emerald-900/10 px-4 py-3">
                    Data quality
                  </th>
                  <th className="border-b border-emerald-900/10 px-4 py-3 text-right">
                    Fee
                  </th>
                  <th className="border-b border-emerald-900/10 px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <DesktopRow key={r.id} r={r} onRemove={() => remove(r.id)} />
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-14 text-center text-[13px] text-emerald-900/40"
                    >
                      No tournaments match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {healthyHidden.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHealthy(true)}
                className="flex w-full items-center justify-center gap-2 border-t border-emerald-900/5 bg-[#fcfcf6] py-3 text-[12.5px] font-semibold text-emerald-900/45 transition hover:text-emerald-900/70"
              >
                <span className="h-[7px] w-[7px] rounded-full bg-emerald-500" />
                {healthyHidden.length} healthy tournaments hidden — show all
              </button>
            )}
          </div>

          {/* ── MOBILE CARDS (<lg) ── */}
          <div className="flex flex-col gap-3 lg:hidden">
            {visibleRows.map((r) => (
              <MobileCard key={r.id} r={r} onRemove={() => remove(r.id)} />
            ))}
            {visibleRows.length === 0 && (
              <div className="rounded-2xl border border-emerald-900/10 bg-white px-4 py-12 text-center text-[14px] text-emerald-900/40">
                No tournaments match your filters.
              </div>
            )}
            {healthyHidden.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHealthy(true)}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-emerald-900/10 bg-[#fcfcf6] py-3.5 text-[14px] font-semibold text-emerald-900/45 transition active:opacity-70"
              >
                <span className="h-[7px] w-[7px] rounded-full bg-emerald-500" />
                {healthyHidden.length} healthy tournaments hidden — show all
              </button>
            )}
          </div>
        </main>
      </div>
    </>
  );

  function toggleQuality(key: Exclude<QualityKey, null>) {
    setQuality((cur) => (cur === key ? null : key));
    // Quality filters are most useful across the whole catalog.
    setView("all");
  }
}

// ───────────────────────────────────────────────────────── pending callout

function PendingCallout({ count }: { count: number }) {
  return (
    <div className="mb-3.5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-50/40 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="relative flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-amber-100">
        <span className="h-3 w-3 rounded-full bg-amber-600" />
        <span className="absolute inset-0 animate-ping rounded-xl border-2 border-amber-500 opacity-40" />
      </div>
      <div className="flex-1">
        <div className="text-[15px] font-extrabold text-amber-900">
          {count} submission{count === 1 ? "" : "s"} waiting in the queue
        </div>
        <div className="mt-0.5 text-[12.5px] font-medium text-amber-800/80">
          Review before they go stale.
        </div>
      </div>
      <a
        href="/admin"
        className="inline-flex items-center justify-center rounded-full bg-amber-600 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-amber-700"
      >
        Review queue →
      </a>
    </div>
  );
}

// ───────────────────────────────────────────────────────── stat tiles

function HealthTile({ health }: { health: number }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-900/40">
          Catalog health
        </div>
        <div className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight text-emerald-950 lg:text-[24px]">
          {health}%
        </div>
        <div className="mt-1 text-[11px] font-medium text-emerald-900/45">
          complete &amp; geocoded
        </div>
      </div>
      <Meter value={health} className="mt-2.5" />
    </div>
  );
}

const TILE_TONE: Record<
  string,
  { val: string; dot: string }
> = {
  red: { val: "text-red-700", dot: "bg-red-500" },
  green: { val: "text-emerald-700", dot: "bg-emerald-500" },
  amber: { val: "text-amber-700", dot: "bg-amber-500" },
  blue: { val: "text-blue-600", dot: "bg-blue-500" },
};

function StatTile({
  label,
  value,
  meta,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  meta: string;
  tone: keyof typeof TILE_TONE;
  active: boolean;
  onClick: () => void;
}) {
  const t = TILE_TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-px ${
        active
          ? "border-emerald-600 ring-2 ring-emerald-600/15"
          : "border-emerald-900/10 hover:border-emerald-900/20"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-900/40">
        <span className={`h-[7px] w-[7px] rounded-full ${t.dot}`} />
        {label}
      </div>
      <div
        className={`mt-1.5 text-2xl font-extrabold leading-none tracking-tight lg:text-[24px] ${t.val}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] font-medium text-emerald-900/45">
        {meta}
      </div>
    </button>
  );
}

function Meter({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div
      className={`h-[7px] overflow-hidden rounded-full bg-emerald-900/[0.06] ${className}`}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────── rail

function RailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm">
      <div className="px-3.5 pb-2 pt-3.5 text-[10px] font-bold uppercase tracking-[0.09em] text-emerald-900/40">
        {title}
      </div>
      <div className="px-2 pb-2.5">{children}</div>
    </div>
  );
}

function RailItem({
  label,
  count,
  on,
  dot,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold transition ${
        on
          ? "bg-emerald-50 text-emerald-700"
          : "text-emerald-900/65 hover:bg-emerald-900/[0.04]"
      }`}
    >
      {dot && <span className={`h-[7px] w-[7px] flex-none rounded-full ${dot}`} />}
      <span className="truncate">{label}</span>
      <span
        className={`ml-auto rounded-full px-2 py-px text-[11px] font-bold ${
          on ? "bg-white text-emerald-700" : "bg-emerald-900/[0.06] text-emerald-900/45"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ───────────────────────────────────────────────────────── mobile pills

function MobileFilterPills({
  view,
  setView,
  quality,
  toggleQuality,
  counts,
}: {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  quality: QualityKey;
  toggleQuality: (k: Exclude<QualityKey, null>) => void;
  counts: { attention: number; total: number; healthy: number; pending: number; noGeo: number; missing: number; dupes: number; stale: number; archived: number };
}) {
  return (
    <div className="lg:hidden">
      <div className="mb-2.5 flex flex-wrap gap-2">
        {(
          [
            ["attention", "Needs attention", counts.attention],
            ["all", "All", counts.total],
            ["healthy", "Healthy", counts.healthy],
          ] as [ViewKey, string, number][]
        ).map(([key, label, n]) => (
          <Pill key={key} on={view === key} onClick={() => setView(key)} label={label} count={n} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Pill dot="bg-red-500" on={quality === "pending"} onClick={() => toggleQuality("pending")} label="Pending" count={counts.pending} />
        <Pill dot="bg-amber-500" on={quality === "noGeo"} onClick={() => toggleQuality("noGeo")} label="No geocode" count={counts.noGeo} />
        <Pill dot="bg-amber-500" on={quality === "missing"} onClick={() => toggleQuality("missing")} label="Missing data" count={counts.missing} />
        <Pill dot="bg-blue-500" on={quality === "dupes"} onClick={() => toggleQuality("dupes")} label="Possible dupes" count={counts.dupes} />
        <Pill dot="bg-emerald-900/25" on={quality === "stale"} onClick={() => toggleQuality("stale")} label="Stale / past" count={counts.stale} />
        <Pill dot="bg-slate-400" on={quality === "archived"} onClick={() => toggleQuality("archived")} label="Archived" count={counts.archived} />
      </div>
    </div>
  );
}

function Pill({
  label,
  count,
  on,
  dot,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 py-2.5 text-[14px] font-bold transition active:opacity-70 ${
        on
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-emerald-900/10 bg-white text-emerald-900/65"
      }`}
    >
      {dot && <span className={`h-[7px] w-[7px] flex-none rounded-full ${dot}`} />}
      {label}
      <span
        className={`rounded-full px-2 py-px text-[13px] font-bold ${
          on ? "bg-white text-emerald-700" : "bg-emerald-900/[0.06] text-emerald-900/45"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ───────────────────────────────────────────────────────── geocode + problems

function GeoChip({ row }: { row: AdminTournamentRow }) {
  if (row.hasCoords) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold text-emerald-700">
        <span className="h-[7px] w-[7px] rounded-full bg-emerald-500" />
        Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11.5px] font-bold text-red-700">
      <span className="h-[7px] w-[7px] rounded-full bg-red-500" />
      Missing
    </span>
  );
}

function ProblemChips({ row }: { row: AdminTournamentRow }) {
  const chips: { label: string; tone: "red" | "amber" }[] = [];
  if (row.noGeo) chips.push({ label: "No geo", tone: "red" });
  for (const m of row.missing) {
    chips.push({ label: m, tone: m === "No date" ? "red" : "amber" });
  }
  if (row.isDuplicate) chips.push({ label: "Dupe?", tone: "amber" });
  if (row.stale) chips.push({ label: "Past end date", tone: "amber" });

  if (chips.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">
        ✓ Clean
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <span
          key={i}
          className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${
            c.tone === "red"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────── row actions hook

/**
 * Wire the real per-row mutations. Which buttons show depends on the row's
 * state, but every button here resolves a genuine server action.
 */
function useRowActions(r: AdminTournamentRow, onRemove: () => void) {
  const router = useRouter();

  const approve = useOptimisticAction(() => approveTournament(r.id), {
    successMessage: `Approved "${r.name}" — now live.`,
    errorMessage: "Couldn't approve. Try again.",
    onSuccess: () => {
      onRemove();
      router.refresh();
    },
  });

  const reject = useOptimisticAction(() => rejectTournament(r.id), {
    successMessage: `Rejected "${r.name}".`,
    errorMessage: "Couldn't reject. Try again.",
    onSuccess: () => {
      onRemove();
      router.refresh();
    },
  });

  const archive = useOptimisticAction(() => archiveTournament(r.id), {
    successMessage: `Archived "${r.name}".`,
    errorMessage: "Couldn't archive. Try again.",
    onSuccess: () => {
      onRemove();
      router.refresh();
    },
  });

  return { approve, reject, archive };
}

// ───────────────────────────────────────────────────────── desktop row

function DesktopRow({
  r,
  onRemove,
}: {
  r: AdminTournamentRow;
  onRemove: () => void;
}) {
  const { approve, reject, archive } = useRowActions(r, onRemove);
  const pending = approve.pending || reject.pending || archive.pending;
  const when = formatWhen(r.date_start, r.date_end);
  const pill = statusPill(r);

  const stripe = r.pending
    ? "shadow-[inset_3px_0_0_var(--tw-shadow-color)] shadow-red-500"
    : r.needsAttention
      ? "shadow-[inset_3px_0_0_var(--tw-shadow-color)] shadow-amber-500"
      : "";

  return (
    <tr
      className={`border-b border-emerald-900/[0.06] transition last:border-0 hover:bg-emerald-50/30 ${
        r.isDuplicate ? "bg-amber-50/40" : ""
      }`}
    >
      <td className={`px-4 py-3 align-middle ${stripe}`}>
        <div className="truncate text-[13.5px] font-bold text-emerald-950">
          <a
            href={`/tournaments/${r.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-emerald-600 hover:underline"
          >
            {r.name}
          </a>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-emerald-900/40">
          <AgeBadge timestamp={r.created_at} prefix="added" className="bg-transparent px-0 normal-case text-emerald-900/40" />
          {r.isDuplicate && (
            <span className="font-semibold text-blue-600">flagged duplicate</span>
          )}
          {!r.source_url && r.pending && (
            <span className="font-semibold text-red-600">no source link</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="whitespace-nowrap text-[12.5px] font-semibold text-emerald-900/70">
          {when.primary}
        </div>
        <div className="text-[11px] font-medium text-emerald-900/40">
          {when.year}
        </div>
      </td>
      <td className="overflow-hidden px-4 py-3 align-middle">
        <div className="truncate text-[12.5px] text-emerald-900/70">
          {r.location_name || "—"}
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_PILL_CLS[pill.tone]}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLS[pill.tone]}`} />
          {pill.label}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        <GeoChip row={r} />
      </td>
      <td className="px-4 py-3 align-middle">
        <span className="inline-block whitespace-nowrap rounded-full bg-emerald-900/[0.06] px-2.5 py-1 text-[11.5px] font-semibold text-emerald-900/65">
          {sourceLabel(r.source_platform)}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        <ProblemChips row={r} />
      </td>
      <td className="px-4 py-3 text-right align-middle">
        <span
          className={`text-[12.5px] font-bold ${
            r.entry_fee == null ? "text-amber-700/60" : "text-emerald-950"
          }`}
        >
          {r.entry_fee != null ? formatCurrency(r.entry_fee) : "—"}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center justify-end gap-1.5">
          {r.pending ? (
            <>
              <button
                type="button"
                onClick={approve.run}
                disabled={pending}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {approve.pending ? "…" : "Approve"}
              </button>
              <a
                href={`/tournaments/${r.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-emerald-900/10 bg-white px-3 py-1.5 text-[11.5px] font-bold text-emerald-900/70 transition hover:border-emerald-900/25"
              >
                Edit →
              </a>
              <button
                type="button"
                onClick={reject.run}
                disabled={pending}
                title="Reject"
                className="rounded-lg border border-emerald-900/10 bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-red-600 transition hover:border-red-200 disabled:opacity-60"
              >
                {reject.pending ? "…" : "✕"}
              </button>
            </>
          ) : r.stale ? (
            <>
              <button
                type="button"
                onClick={archive.run}
                disabled={pending}
                className="rounded-lg border border-emerald-900/10 bg-white px-3 py-1.5 text-[11.5px] font-bold text-emerald-900/70 transition hover:border-emerald-900/25 disabled:opacity-60"
              >
                {archive.pending ? "…" : "Archive"}
              </button>
              <a
                href={`/tournaments/${r.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-emerald-900/10 bg-white font-bold text-emerald-900/45 transition hover:text-emerald-900"
              >
                ↗
              </a>
            </>
          ) : (
            <a
              href={`/tournaments/${r.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-emerald-900/10 bg-white px-3 py-1.5 text-[11.5px] font-bold text-emerald-900/70 transition hover:border-emerald-900/25"
            >
              {r.noGeo || r.missing.length > 0 ? "Edit →" : "Open ↗"}
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

// ───────────────────────────────────────────────────────── mobile card

function MobileCard({
  r,
  onRemove,
}: {
  r: AdminTournamentRow;
  onRemove: () => void;
}) {
  const { approve, reject, archive } = useRowActions(r, onRemove);
  const pending = approve.pending || reject.pending || archive.pending;
  const when = formatWhen(r.date_start, r.date_end);
  const pill = statusPill(r);

  const stripe = r.pending
    ? "before:bg-red-500"
    : r.stale
      ? "before:bg-amber-700"
      : r.needsAttention
        ? "before:bg-amber-500"
        : "before:bg-emerald-500";

  return (
    <div
      className={`relative flex flex-col gap-3 overflow-hidden rounded-[14px] border border-emerald-900/10 bg-white p-4 before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[''] ${stripe} ${
        r.isDuplicate ? "bg-amber-50/40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={`/tournaments/${r.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-[16px] font-bold leading-snug text-emerald-950"
          >
            {r.name}
          </a>
          {r.isDuplicate && (
            <span className="mt-1 inline-flex text-[13px] font-semibold text-blue-600">
              flagged duplicate
            </span>
          )}
        </div>
        <span
          className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-bold ${STATUS_PILL_CLS[pill.tone]}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLS[pill.tone]}`} />
          {pill.label}
        </span>
      </div>

      {/* meta line */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-emerald-900/55">
        <span>
          {when.primary === "—" ? (
            <span className="text-emerald-900/45">no date</span>
          ) : (
            <>
              <b className="font-bold text-emerald-900/75">{when.primary}</b>{" "}
              {when.year}
            </>
          )}
        </span>
        <span className="text-emerald-900/25">·</span>
        <span>{r.location_name || "no venue"}</span>
        <span className="text-emerald-900/25">·</span>
        <span className="rounded-full border border-emerald-900/10 bg-emerald-900/[0.04] px-2.5 py-0.5 text-[13px] font-semibold text-emerald-900/65">
          {sourceLabel(r.source_platform)}
        </span>
        {r.entry_fee != null && (
          <>
            <span className="text-emerald-900/25">·</span>
            <span>
              <b className="font-bold text-emerald-900/75">
                {formatCurrency(r.entry_fee)}
              </b>
            </span>
          </>
        )}
        <span className="text-emerald-900/25">·</span>
        <AgeBadge
          timestamp={r.created_at}
          prefix={r.pending ? "submitted" : "added"}
          className="bg-transparent px-0 normal-case text-emerald-900/45"
        />
        {!r.source_url && r.pending && (
          <>
            <span className="text-emerald-900/25">·</span>
            <span className="font-semibold text-red-600">no source link</span>
          </>
        )}
      </div>

      {/* flags */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold ${
            r.hasCoords
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          <span
            className={`h-[7px] w-[7px] rounded-full ${r.hasCoords ? "bg-emerald-500" : "bg-red-500"}`}
          />
          {r.hasCoords ? "Geo resolved" : "Geo missing"}
        </span>
        {r.missing.map((m) => (
          <span
            key={m}
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-bold ${
              m === "No date"
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {m}
          </span>
        ))}
        {r.isDuplicate && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[13px] font-bold text-amber-700">
            Dupe?
          </span>
        )}
        {r.stale && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[13px] font-bold text-amber-700">
            Past end date
          </span>
        )}
      </div>

      {/* actions */}
      <div className="flex gap-2">
        {r.pending ? (
          <>
            <button
              type="button"
              onClick={approve.run}
              disabled={pending}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-emerald-600 text-[15px] font-bold text-white shadow-sm transition active:brightness-95 disabled:opacity-60"
            >
              {approve.pending ? "Approving…" : "Approve"}
            </button>
            <a
              href={`/tournaments/${r.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-emerald-900/15 bg-white text-[15px] font-bold text-emerald-900"
            >
              Edit →
            </a>
            <button
              type="button"
              onClick={reject.run}
              disabled={pending}
              aria-label="Reject"
              className="inline-flex h-11 w-[52px] flex-none items-center justify-center rounded-full border border-emerald-900/15 bg-white text-[15px] font-bold text-red-700 disabled:opacity-60"
            >
              {reject.pending ? "…" : "✕"}
            </button>
          </>
        ) : r.stale ? (
          <>
            <button
              type="button"
              onClick={archive.run}
              disabled={pending}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-emerald-600 text-[15px] font-bold text-white shadow-sm transition active:brightness-95 disabled:opacity-60"
            >
              {archive.pending ? "Archiving…" : "Archive"}
            </button>
            <a
              href={`/tournaments/${r.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-emerald-900/15 bg-white text-[15px] font-bold text-emerald-900"
            >
              Open ↗
            </a>
          </>
        ) : (
          <a
            href={`/tournaments/${r.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-emerald-900/15 bg-white text-[15px] font-bold text-emerald-900"
          >
            {r.noGeo || r.missing.length > 0 ? "Edit →" : "Open ↗"}
          </a>
        )}
      </div>
    </div>
  );
}
