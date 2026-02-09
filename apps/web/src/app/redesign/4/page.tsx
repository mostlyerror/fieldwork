"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import DesignSwitcher from "@/components/design-switcher";

// --- DESIGN 4: MINIMAL & PREMIUM ---
// Extreme whitespace, refined typography, muted palette, subtle
// hover states, feels like a high-end lifestyle brand.

function PremiumCard({ tournament }: { tournament: Tournament }) {
  const dateObj = new Date(tournament.date_start + "T00:00:00");
  const month = dateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = dateObj.getDate();

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="group flex gap-5 py-6"
    >
      {/* Date block */}
      <div className="flex w-16 flex-shrink-0 flex-col items-center">
        <span className="text-[10px] font-medium tracking-[0.2em] text-gray-400">{month}</span>
        <span className="text-3xl font-light text-gray-900">{day}</span>
      </div>

      {/* Divider */}
      <div className="w-px bg-gray-200 transition-colors group-hover:bg-green-400" />

      {/* Content */}
      <div className="flex-1 pt-0.5">
        <h3 className="text-lg font-medium text-gray-900 transition-colors group-hover:text-green-700">
          {tournament.name}
        </h3>
        <p className="mt-1 text-sm text-gray-400">
          {tournament.location_name}
        </p>
        <div className="mt-3 flex items-center gap-4">
          {tournament.entry_fee != null && (
            <span className="text-sm text-gray-500">
              {formatCurrency(tournament.entry_fee)}
            </span>
          )}
          {tournament.registration_status && (
            <span className={`text-xs uppercase tracking-wider ${
              tournament.registration_status === "open"
                ? "text-green-600"
                : tournament.registration_status === "filling"
                ? "text-amber-600"
                : "text-gray-400"
            }`}>
              {tournament.registration_status}
            </span>
          )}
          {tournament.format && (
            <span className="text-xs text-gray-300">
              {tournament.format.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center">
        <span className="text-gray-200 transition-all group-hover:translate-x-1 group-hover:text-green-500">
          →
        </span>
      </div>
    </Link>
  );
}

export default function Design4() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
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
      const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return Object.entries(groups);
  }, [filtered]);

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="mx-auto max-w-3xl px-6">
        <div className="flex items-center justify-between py-8">
          <Link href="/redesign/4">
            <span className="text-lg font-light tracking-[0.15em] text-gray-900">PICKLERADAR</span>
          </Link>
          <span className="text-xs tracking-[0.2em] text-gray-300">HOUSTON</span>
        </div>
      </nav>

      {/* Hero */}
      <header className="mx-auto max-w-3xl px-6 pb-16 pt-12">
        <h1 className="text-4xl font-light leading-tight text-gray-900 md:text-5xl">
          Upcoming
          <br />
          <span className="font-normal italic text-green-700">Tournaments</span>
        </h1>
        <div className="mt-10">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full max-w-xs border-b border-gray-200 bg-transparent py-2 text-sm text-gray-900 placeholder-gray-300 focus:border-green-500 focus:outline-none"
          />
        </div>
      </header>

      {/* Tournament list */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        {grouped.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-300">
            No upcoming tournaments
          </p>
        ) : (
          grouped.map(([month, items]) => (
            <div key={month} className="mb-12">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-gray-300">
                {month}
              </h2>
              <div className="divide-y divide-gray-100">
                {items.map((t) => (
                  <PremiumCard key={t.id} tournament={t} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-3xl border-t border-gray-100 px-6 py-10">
        <div className="flex items-center justify-between">
          <span className="text-xs tracking-[0.15em] text-gray-300">
            PICKLERADAR &copy; {new Date().getFullYear()}
          </span>
          <span className="text-xs text-gray-300">
            Multi-source aggregation
          </span>
        </div>
      </footer>

      <DesignSwitcher />
    </div>
  );
}
