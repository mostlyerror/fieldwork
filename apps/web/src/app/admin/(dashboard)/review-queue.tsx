"use client";

/**
 * Review queue — the pending_review triage list for the /admin cockpit.
 *
 * Each submission is a compact, scannable row with a left urgency stripe.
 * A "clean" row (all required fields + coordinates) shows a one-click inline
 * Approve (optimistic removal + toast, reusing approveTournament) and a quiet
 * Reject. A "needs-edit" row expands the full edit form in place, reusing
 * updateAndApproveTournament. No full reload — optimistic + router.refresh().
 *
 * Rows are pre-sorted by urgency on the server; this component owns only the
 * interactive state (which row is expanded, optimistic removals).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveTournament,
  rejectTournament,
  updateAndApproveTournament,
} from "./actions";
import { useOptimisticAction } from "@/components/admin/use-optimistic-action";
import { AgeBadge } from "@/components/admin/age-badge";
import {
  SKILL_LEVELS,
  FORMAT_OPTIONS,
  SOURCE_DISPLAY_NAMES,
} from "@/lib/constants";
import type { AdminStatus } from "@/lib/admin-status";

export interface PendingTournament {
  id: string;
  name: string;
  date_start: string;
  date_end: string | null;
  location_name: string;
  location_address: string | null;
  entry_fee: number | null;
  skill_levels: string[] | null;
  format: string | null;
  description: string | null;
  source_platform: string | null;
  source_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

const DAY_MS = 86_400_000;

const STRIPE: Record<AdminStatus, string> = {
  critical: "bg-red-500",
  attention: "bg-amber-500",
  healthy: "bg-emerald-300",
};

/** Calendar-day diff (today = 0, tomorrow = +1, yesterday = -1). */
function daysUntil(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / DAY_MS);
}

function formatStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const n = daysUntil(dateStr);
  const month = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (n < 0) return `Started ${month} · ${-n}d ago`;
  if (n === 0) return `Starts today · ${month}`;
  if (n === 1) return `Starts tomorrow · ${month}`;
  if (n <= 14) return `Starts in ${n}d · ${month}`;
  return `Starts ${month}`;
}

/** Required fields for a "clean" approval (besides coordinates). */
function missingFields(t: PendingTournament): string[] {
  const out: string[] = [];
  if (!t.name?.trim()) out.push("name");
  if (!t.date_start) out.push("start date");
  if (!t.location_name?.trim()) out.push("venue");
  return out;
}

function isClean(t: PendingTournament): boolean {
  const hasCoords = t.latitude != null && t.longitude != null;
  return hasCoords && missingFields(t).length === 0;
}

export function ReviewQueue({ items }: { items: PendingTournament[] }) {
  // Optimistic removals — rows fade out of the list on approve/reject.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = useMemo(
    () => items.filter((t) => !removed.has(t.id)),
    [items, removed]
  );

  function remove(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
    if (openId === id) setOpenId(null);
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-900/10 bg-white p-10 text-center">
        <div className="t-body font-extrabold tracking-tight text-emerald-950">
          Queue clear
        </div>
        <p className="t-small mt-1 text-emerald-900/50">
          Every submission has been triaged. Catalog is up to date.
        </p>
      </div>
    );
  }

  const cleanCount = visible.filter(isClean).length;

  return (
    <>
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between lg:mb-3.5">
        <div>
          <h2 className="t-h2 text-emerald-950">
            Pending review
          </h2>
          <p className="t-small mt-0.5 text-emerald-900/45">
            {visible.length} submission{visible.length === 1 ? "" : "s"} · sorted
            by urgency
            {cleanCount > 0 && ` · ${cleanCount} clean & ready`}
          </p>
        </div>
      </div>

      {/* ── Desktop column headers (table-like wide rows). Venue + Source
            fold away between lg and xl so the row never overflows. ── */}
      <div className="mb-1.5 hidden items-center gap-3 px-5 lg:flex 2xl:gap-4">
        <span className="min-w-0 flex-1 t-label font-extrabold text-emerald-900/35">
          Tournament
        </span>
        <span className="w-[120px] flex-none t-label font-extrabold text-emerald-900/35 2xl:w-[140px]">
          When
        </span>
        <span className="hidden w-[200px] flex-none t-label font-extrabold text-emerald-900/35 2xl:block">
          Venue
        </span>
        <span className="hidden w-[140px] flex-none t-label font-extrabold text-emerald-900/35 2xl:block">
          Source
        </span>
        <span className="w-[120px] flex-none t-label font-extrabold text-emerald-900/35 2xl:w-[130px]">
          Geocode
        </span>
        <span className="w-[96px] flex-none t-label font-extrabold text-emerald-900/35 2xl:w-[110px]">
          Waiting
        </span>
        <span className="w-[200px] flex-none text-right t-label font-extrabold text-emerald-900/35 2xl:w-[210px]">
          Actions
        </span>
      </div>

      <div className="flex flex-col gap-2.5 lg:gap-2.5">
        {visible.map((t) => (
          <QueueRow
            key={t.id}
            t={t}
            open={openId === t.id}
            onToggle={() => setOpenId((cur) => (cur === t.id ? null : t.id))}
            onDone={() => remove(t.id)}
          />
        ))}
      </div>
    </>
  );
}

function QueueRow({
  t,
  open,
  onToggle,
  onDone,
}: {
  t: PendingTournament;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const hasCoords = t.latitude != null && t.longitude != null;
  const missing = missingFields(t);
  const clean = hasCoords && missing.length === 0;
  const n = daysUntil(t.date_start);
  const dateSoon = n <= 7;

  // Stripe urgency: red if date imminent/passed; amber if needs edit; else green.
  const stripe: AdminStatus = dateSoon
    ? "critical"
    : !clean
      ? "attention"
      : "healthy";

  const sourceName = t.source_platform
    ? SOURCE_DISPLAY_NAMES[t.source_platform] ?? t.source_platform
    : null;

  const approve = useOptimisticAction(() => approveTournament(t.id), {
    successMessage: `Approved "${t.name}" — now live on the map.`,
    errorMessage: "Couldn't approve. Try again.",
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });

  const reject = useOptimisticAction(() => rejectTournament(t.id), {
    successMessage: `Rejected "${t.name}".`,
    errorMessage: "Couldn't reject. Try again.",
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });

  // Shared approve / collapse-edit / reject button cluster. `compact` shrinks
  // padding for the dense desktop row; mobile uses full-bleed equal buttons.
  const approveBtn = clean ? (
    <button
      type="button"
      onClick={approve.run}
      disabled={approve.pending || reject.pending}
      className="t-body inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {approve.pending ? "Approving…" : "Approve"}
    </button>
  ) : (
    <button
      type="button"
      onClick={onToggle}
      className="t-body inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-900/15 bg-white px-4 py-2 font-bold text-emerald-900 transition hover:border-emerald-900/30"
    >
      {open ? "Collapse ▴" : "Review & edit ▾"}
    </button>
  );

  const rejectBtn = (
    <button
      type="button"
      onClick={reject.run}
      disabled={approve.pending || reject.pending}
      className="t-caption rounded-full px-2.5 py-2 font-bold text-emerald-900/35 transition hover:text-red-600 disabled:opacity-50"
    >
      {reject.pending ? "…" : "Reject"}
    </button>
  );

  const editForm = open ? (
    <EditForm
      t={t}
      missing={missing}
      hasCoords={hasCoords}
      onDone={onDone}
      onCancel={onToggle}
    />
  ) : null;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white transition lg:rounded-[14px] ${
        open
          ? "border-amber-200 shadow-md shadow-amber-900/5"
          : "border-emerald-900/10 hover:shadow-md hover:shadow-emerald-900/5"
      }`}
    >
      {/* ════════════ MOBILE CARD (<lg) ════════════ */}
      <div className="lg:hidden">
        <div className="flex">
          <span
            aria-hidden="true"
            className={`w-1 flex-none ${STRIPE[stripe]}`}
          />
          <div className="min-w-0 flex-1 p-4">
            <div className="flex items-start justify-between gap-2.5">
              <div className="t-h3 min-w-0 leading-tight tracking-tight text-emerald-950">
                {t.name || (
                  <span className="italic text-emerald-900/40">Untitled</span>
                )}
              </div>
              <AgeBadge
                timestamp={t.created_at}
                prefix="waiting"
                staleMs={DAY_MS}
                criticalMs={3 * DAY_MS}
                className="flex-none"
              />
            </div>

            <div className="t-small mt-2.5 flex flex-wrap items-center gap-2">
              <span
                className={`font-bold ${dateSoon ? "text-red-600" : "text-emerald-900/70"}`}
              >
                {formatStart(t.date_start)}
              </span>
              {t.location_name && (
                <span className="text-emerald-900/55">
                  · {t.location_name}
                </span>
              )}
              {sourceName && (
                <span className="t-caption rounded-full border border-emerald-900/10 bg-emerald-900/[0.04] px-2.5 py-1 font-bold text-emerald-900/60">
                  {sourceName}
                </span>
              )}
              <span
                className={`t-caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold ${
                  hasCoords
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${hasCoords ? "bg-emerald-500" : "bg-amber-500"}`}
                />
                {hasCoords ? "geocoded" : "no coordinates"}
              </span>
            </div>

            {editForm}

            {/* When the editor is open, its own footer carries Save & approve /
                Cancel — so the plain row cluster is hidden to avoid duplicates. */}
            <div className={`mt-3 flex items-stretch gap-2 ${open ? "hidden" : ""}`}>
              {clean ? (
                <button
                  type="button"
                  onClick={approve.run}
                  disabled={approve.pending || reject.pending}
                  className="t-body flex h-11 flex-1 items-center justify-center rounded-full bg-emerald-600 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {approve.pending ? "Approving…" : "Approve"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onToggle}
                  className="t-body flex h-11 flex-1 items-center justify-center rounded-full border border-emerald-900/15 bg-white font-bold text-emerald-900 transition active:opacity-70"
                >
                  {open ? "Collapse ▴" : "Review & edit ▾"}
                </button>
              )}
              <button
                type="button"
                onClick={reject.run}
                disabled={approve.pending || reject.pending}
                className="t-body flex h-11 flex-none items-center justify-center rounded-full border border-emerald-900/15 bg-white px-5 font-bold text-emerald-900/55 transition hover:text-red-600 disabled:opacity-50"
              >
                {reject.pending ? "…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ DESKTOP TABLE ROW (lg+) ════════════ */}
      <div className="hidden lg:flex lg:flex-col">
        <div className="flex items-stretch">
          <span
            aria-hidden="true"
            className={`w-[5px] flex-none ${STRIPE[stripe]}`}
          />
          <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 2xl:gap-4">
            <div className="t-body min-w-0 flex-1 truncate font-bold tracking-tight text-emerald-950">
              {t.name || (
                <span className="italic text-emerald-900/40">Untitled</span>
              )}
            </div>
            <div className="t-caption w-[120px] flex-none 2xl:w-[140px]">
              <span
                className={`font-bold ${dateSoon ? "text-red-600" : "text-emerald-900/65"}`}
              >
                {formatStart(t.date_start)}
              </span>
            </div>
            <div className="t-caption hidden w-[200px] flex-none truncate text-emerald-900/65 2xl:block">
              {t.location_name || (
                <span className="text-emerald-900/30">—</span>
              )}
            </div>
            <div className="hidden w-[140px] flex-none 2xl:block">
              {sourceName ? (
                <span className="t-caption rounded-full border border-emerald-900/10 bg-emerald-900/[0.04] px-2 py-0.5 font-bold text-emerald-900/60">
                  {sourceName}
                </span>
              ) : (
                <span className="t-caption text-emerald-900/30">—</span>
              )}
            </div>
            <div className="w-[120px] flex-none 2xl:w-[130px]">
              <span
                className={`t-caption inline-flex items-center gap-1.5 font-semibold ${
                  hasCoords ? "text-emerald-900/55" : "text-amber-600"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-[7px] w-[7px] flex-none rounded-full ${hasCoords ? "bg-emerald-500" : "bg-amber-500"}`}
                />
                {hasCoords ? "geocoded" : "no coords"}
              </span>
            </div>
            <div className="w-[96px] flex-none 2xl:w-[110px]">
              <AgeBadge
                timestamp={t.created_at}
                staleMs={DAY_MS}
                criticalMs={3 * DAY_MS}
              />
            </div>
            <div className="flex w-[200px] flex-none items-center justify-end gap-2 2xl:w-[210px]">
              {approveBtn}
              {rejectBtn}
            </div>
          </div>
        </div>

        {/* Expanded edit form spans the full row width (reuses updateAndApprove) */}
        {editForm}
      </div>
    </div>
  );
}

function EditForm({
  t,
  missing,
  hasCoords,
  onDone,
  onCancel,
}: {
  t: PendingTournament;
  missing: string[];
  hasCoords: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(t.name);
  const [dateStart, setDateStart] = useState(t.date_start);
  const [dateEnd, setDateEnd] = useState(t.date_end ?? "");
  const [locationName, setLocationName] = useState(t.location_name ?? "");
  const [locationAddress, setLocationAddress] = useState(
    t.location_address ?? ""
  );
  const [entryFee, setEntryFee] = useState(t.entry_fee?.toString() ?? "");
  const [skillLevels, setSkillLevels] = useState<string[]>(
    t.skill_levels ?? []
  );
  const [format, setFormat] = useState(t.format ?? "");
  const [description, setDescription] = useState(t.description ?? "");

  const save = useOptimisticAction(
    () =>
      updateAndApproveTournament(t.id, {
        name,
        date_start: dateStart,
        date_end: dateEnd || null,
        location_name: locationName,
        location_address: locationAddress || null,
        entry_fee: entryFee ? Number(entryFee) : null,
        skill_levels: skillLevels.length > 0 ? skillLevels : null,
        format: format || null,
        description: description || null,
      }),
    {
      successMessage: `Saved & approved "${name}".`,
      errorMessage: "Couldn't save. Check the fields and retry.",
      onSuccess: () => {
        onDone();
        router.refresh();
      },
    }
  );

  function toggleLevel(level: string) {
    setSkillLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  const fixNotes: string[] = [];
  if (!hasCoords) fixNotes.push("address didn't geocode");
  for (const m of missing) fixNotes.push(`${m} missing`);

  const inputCls =
    "w-full rounded-lg border border-emerald-900/15 bg-white px-3 py-2 text-[13px] text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  const labelCls =
    "t-label mb-1 block font-extrabold text-emerald-900/40";

  return (
    <div className="mt-3 border-t border-dashed border-emerald-900/15 pt-4 lg:mt-0 lg:bg-amber-50/30 lg:px-[22px] lg:pb-5 lg:pt-[18px]">
      {fixNotes.length > 0 && (
        <div className="t-caption mb-3.5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-700 lg:border-0 lg:bg-transparent lg:p-0">
          <span aria-hidden="true">⚠</span>
          Needs a fix before approve: {fixNotes.join(" · ")}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelCls}>Name</label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Venue</label>
          <input
            className={inputCls}
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>
            Address{!hasCoords && " · won't geocode"}
          </label>
          <input
            className={`${inputCls} ${!hasCoords ? "border-amber-400 bg-amber-50/60" : ""}`}
            value={locationAddress}
            onChange={(e) => setLocationAddress(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Entry fee</label>
          <input
            type="number"
            className={inputCls}
            value={entryFee}
            onChange={(e) => setEntryFee(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className={labelCls}>Start</label>
          <input
            type="date"
            className={`${inputCls} ${!dateStart ? "border-amber-400 bg-amber-50/60" : ""}`}
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>End</label>
          <input
            type="date"
            className={inputCls}
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Format</label>
          <select
            className={inputCls}
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="">None</option>
            {FORMAT_OPTIONS.filter((f) => f.value !== "").map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className={labelCls}>Skill levels</label>
        <div className="flex flex-wrap gap-1.5">
          {SKILL_LEVELS.map((level) => {
            const on = skillLevels.includes(level);
            return (
              <button
                key={level}
                type="button"
                onClick={() => toggleLevel(level)}
                className={`t-caption rounded-full px-2.5 py-1 font-semibold transition ${
                  on
                    ? "bg-emerald-600 text-white"
                    : "border border-emerald-900/10 bg-emerald-900/[0.04] text-emerald-900/55 hover:bg-emerald-900/[0.08]"
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        <label className={labelCls}>Description</label>
        <textarea
          className={inputCls}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {t.source_url && (
        <a
          href={t.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="t-caption mt-2.5 block truncate font-semibold text-emerald-700 underline decoration-emerald-200 underline-offset-2 hover:text-emerald-800"
        >
          Source: {t.source_url}
        </a>
      )}

      <div className="mt-4 flex items-stretch justify-end gap-2.5 lg:items-center">
        <button
          type="button"
          onClick={onCancel}
          disabled={save.pending}
          className="t-body flex h-11 flex-none items-center justify-center rounded-full border border-emerald-900/15 bg-white px-5 font-bold text-emerald-900/55 transition hover:text-emerald-900/80 disabled:opacity-50 lg:h-auto lg:border-0 lg:px-3 lg:py-2 lg:text-[12px] lg:text-emerald-900/40 lg:hover:text-emerald-900/70"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save.run}
          disabled={save.pending}
          className="t-body flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-600 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 lg:h-auto lg:flex-none lg:px-5 lg:py-2 lg:text-sm"
        >
          {save.pending ? "Saving…" : "Save & approve"}
        </button>
      </div>
    </div>
  );
}
