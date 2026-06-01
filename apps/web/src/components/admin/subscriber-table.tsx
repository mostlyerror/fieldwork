"use client";

/**
 * <SubscriberTable> — the email-subscriber list for the audience cockpit.
 *
 * Client-side filter chips (All / Active / Unsub) + email search over the
 * already-fetched subscriber rows. Renders a wide table on desktop (hidden
 * lg:block) and stacked cards on mobile (lg:hidden) over the SAME filtered
 * data. Read-only — there are no subscriber mutations in the current app.
 */

import { useMemo, useState } from "react";

export interface Subscriber {
  id: string;
  email: string;
  status: string;
  created_at: string;
}

type Filter = "all" | "active" | "unsubscribed";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "unsubscribed", label: "Unsub" },
];

export function SubscriberTable({
  subscribers,
  total,
}: {
  subscribers: Subscriber[];
  total: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subscribers.filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (q && !s.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [subscribers, filter, query]);

  return (
    <aside className="lg:sticky lg:top-[78px]">
      <div className="mb-3.5 flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold tracking-tight text-emerald-950">
          Subscribers
        </h2>
        <span className="text-xs font-semibold text-emerald-900/40">
          {total} total · email list
        </span>
      </div>

      {/* filter chips + search */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-4 py-2 text-xs font-bold transition lg:py-1.5 ${
              filter === f.key
                ? "border-emerald-950 bg-emerald-950 text-white"
                : "border-emerald-900/15 bg-white text-emerald-900/70 hover:border-emerald-900/30"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="w-full lg:ml-1 lg:w-auto lg:flex-1">
          <input
            type="text"
            inputMode="email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email…"
            className="w-full rounded-full border border-emerald-900/15 bg-white px-4 py-2.5 text-sm text-emerald-900 placeholder:text-emerald-900/35 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 lg:py-1.5 lg:text-xs"
          />
        </div>
      </div>

      {/* DESKTOP table */}
      <div className="hidden overflow-hidden rounded-2xl border border-emerald-900/10 bg-white lg:block">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-emerald-900/10 text-[10px] font-bold uppercase tracking-[0.05em] text-emerald-900/40">
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.id}
                className="border-b border-emerald-900/[0.06] last:border-0"
              >
                <td className="px-4 py-2.5 font-semibold text-emerald-950">
                  {s.email}
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill status={s.status} />
                </td>
                <td className="px-4 py-2.5 text-[11px] font-semibold text-emerald-900/40">
                  {timeAgo(s.created_at)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-12 text-center text-sm text-emerald-900/40"
                >
                  No subscribers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between bg-emerald-900/[0.03] px-4 py-2.5 text-[11px] font-semibold text-emerald-900/55">
          <span>
            Showing {rows.length} of {total}
          </span>
        </div>
      </div>

      {/* MOBILE cards */}
      <div className="space-y-3 lg:hidden">
        {rows.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-900/10 bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-emerald-950">
                {s.email}
              </div>
              <div className="mt-1 text-xs font-semibold text-emerald-900/40">
                Joined {timeAgo(s.created_at)}
              </div>
            </div>
            <StatusPill status={s.status} />
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-2xl border border-emerald-900/10 bg-white p-8 text-center text-sm text-emerald-900/40">
            No subscribers match.
          </div>
        )}
        {rows.length > 0 && (
          <p className="pt-1 text-center text-[11px] font-semibold text-emerald-900/40">
            Showing {rows.length} of {total}
          </p>
        )}
      </div>
    </aside>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex flex-none items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-emerald-900/[0.06] text-emerald-900/45"
      }`}
    >
      {active ? "Active" : "Unsub"}
    </span>
  );
}
