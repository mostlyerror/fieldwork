"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import DesignSwitcher from "@/components/design-switcher";

// --- DESIGN 6: MINIMAL LIGHT TIMELINE ---
// Design 4's timeline structure with green accents.
// No marketing copy. Just content, clean grouping.

function TimelineCard({ tournament }: { tournament: Tournament }) {
  const dateObj = new Date(tournament.date_start + "T00:00:00");
  const month = dateObj
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  const day = dateObj.getDate();

  const statusColor: Record<string, string> = {
    open: "text-emerald-600",
    filling: "text-amber-600",
    full: "text-red-500",
    closed: "text-gray-400",
  };

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="group flex gap-5 py-5"
    >
      {/* Date block */}
      <div className="flex w-14 flex-shrink-0 flex-col items-center">
        <span className="text-[10px] font-medium tracking-[0.2em] text-gray-400">
          {month}
        </span>
        <span className="text-2xl font-light text-gray-700">{day}</span>
      </div>

      {/* Divider */}
      <div className="w-px bg-gray-200 transition-colors group-hover:bg-gradient-to-b group-hover:from-green-500 group-hover:to-emerald-500" />

      {/* Content */}
      <div className="flex-1 pt-0.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium text-gray-800 transition-colors group-hover:text-green-600">
            {tournament.name}
          </h3>
          <span
            className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider ${statusColor[tournament.registration_status ?? "open"]}`}
          >
            {tournament.registration_status ?? "open"}
          </span>
        </div>

        <p className="mt-1 text-sm text-gray-500">{tournament.location_name}</p>

        <div className="mt-2.5 flex items-center gap-4">
          {tournament.entry_fee != null && (
            <span className="text-sm font-medium text-gray-600">
              {formatCurrency(tournament.entry_fee)}
            </span>
          )}
          {tournament.format && (
            <span className="text-xs text-gray-400">
              {tournament.format.replace(/_/g, " ")}
            </span>
          )}
          {tournament.skill_levels && tournament.skill_levels.length > 0 && (
            <div className="flex gap-1">
              {tournament.skill_levels.map((s) => (
                <span
                  key={s}
                  className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center">
        <span className="text-gray-300 transition-all group-hover:translate-x-1 group-hover:text-green-500">
          →
        </span>
      </div>
    </Link>
  );
}

export default function Design6() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tournaments?status=eq.active&date_start=gte.${new Date().toISOString().split("T")[0]}&order=date_start.asc&select=*`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      }
    )
      .then((r) => r.json())
      .then((data) => setTournaments(data ?? []))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!search) return tournaments;
    const q = search.toLowerCase();
    return tournaments.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.location_name.toLowerCase().includes(q)
    );
  }, [tournaments, search]);

  // Group by month
  const grouped = useMemo(() => {
    const groups: Record<string, Tournament[]> = {};
    for (const t of filtered) {
      const d = new Date(t.date_start + "T00:00:00");
      const key = d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return Object.entries(groups);
  }, [filtered]);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/redesign/6" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-green-500 to-emerald-600" />
            <span className="text-sm font-semibold tracking-wide text-gray-700">
              PICKLERADAR
            </span>
          </Link>
          <span className="text-xs tracking-[0.15em] text-gray-400">
            HOUSTON
          </span>
        </div>
      </nav>

      {/* Header — no marketing, just functional */}
      <header className="mx-auto max-w-3xl px-6 pb-8 pt-12">
        <h1 className="text-2xl font-medium text-gray-800">
          Upcoming Tournaments
        </h1>
        <div className="mt-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full max-w-xs border-b border-gray-200 bg-transparent py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-green-500 focus:outline-none"
          />
        </div>
      </header>

      {/* Timeline list */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        {grouped.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">
            No upcoming tournaments
          </p>
        ) : (
          grouped.map(([month, items]) => (
            <div key={month} className="mb-10">
              <h2 className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-gray-400">
                {month}
              </h2>
              <div className="divide-y divide-gray-100">
                {items.map((t) => (
                  <TimelineCard key={t.id} tournament={t} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-8">
          <span className="text-[11px] tracking-[0.12em] text-gray-400">
            PICKLERADAR &copy; {new Date().getFullYear()}
          </span>
        </div>
      </footer>

      <DesignSwitcher />
    </div>
  );
}
