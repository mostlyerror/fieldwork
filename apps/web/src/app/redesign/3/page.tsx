"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import DesignSwitcher from "@/components/design-switcher";

// --- DESIGN 3: DATA-DRIVEN (LIGHT) ---
// Lead with metrics, dense table-style layout, sortable columns,
// registration status front-and-center. Clean light analytics look.

const STATUS_DOT: Record<string, string> = {
  open: "bg-emerald-500",
  filling: "bg-amber-500",
  full: "bg-red-500",
  closed: "bg-gray-400",
};

export default function Design3() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sortKey, setSortKey] = useState<"date" | "fee" | "name">("date");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tournaments?status=eq.active&date_start=gte.${new Date().toISOString().split("T")[0]}&order=date_start.asc&select=*`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    })
      .then((r) => r.json())
      .then((data) => setTournaments(data ?? []))
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const open = tournaments.filter((t) => t.registration_status === "open" || !t.registration_status).length;
    const thisMonth = tournaments.filter((t) => {
      const d = new Date(t.date_start);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const venues = new Set(tournaments.map((t) => t.location_name)).size;
    return { total: tournaments.length, open, thisMonth, venues };
  }, [tournaments]);

  const filtered = useMemo(() => {
    let result = tournaments;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) => t.name.toLowerCase().includes(q) || t.location_name.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      if (sortKey === "fee") return (a.entry_fee ?? 0) - (b.entry_fee ?? 0);
      if (sortKey === "name") return a.name.localeCompare(b.name);
      return a.date_start.localeCompare(b.date_start);
    });
  }, [tournaments, search, sortKey]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/redesign/3" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 text-sm font-black text-white">
              PU
            </div>
            <span className="text-sm font-bold text-gray-900">PickleUp</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live data
            </span>
            <span>Updated every 5 min</span>
          </div>
        </div>
      </nav>

      {/* Stats bar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-gray-200 sm:grid-cols-4">
          {[
            { label: "Total Upcoming", value: stats.total, color: "text-gray-900" },
            { label: "Open Registration", value: stats.open, color: "text-emerald-600" },
            { label: "This Month", value: stats.thisMonth, color: "text-amber-600" },
            { label: "Unique Venues", value: stats.venues, color: "text-blue-600" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white px-6 py-4">
              <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tournaments..."
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-64"
          />
          <div className="flex gap-1">
            {(["date", "name", "fee"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  sortKey === key
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Sort by {key}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tournament</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Venue</th>
                <th className="px-4 py-3">Levels</th>
                <th className="px-4 py-3 text-right">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No tournaments match your search
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[t.registration_status ?? "open"]}`} />
                        <span className="text-xs capitalize text-gray-500">
                          {t.registration_status ?? "open"}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/tournaments/${t.id}`}
                        className="font-medium text-gray-900 hover:text-emerald-600"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {formatDateRange(t.date_start, t.date_end)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {t.location_name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {t.skill_levels?.map((s) => (
                          <span
                            key={s}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-gray-700">
                      {t.entry_fee != null ? formatCurrency(t.entry_fee) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-400">
        PickleUp &middot; Data aggregated from PickleballBrackets & Pickleball Den &middot; Auto-refreshed every 5 minutes
      </footer>

      <DesignSwitcher />
    </div>
  );
}
