"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { SKILL_LEVELS, FORMAT_OPTIONS } from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";
import DesignSwitcher from "@/components/design-switcher";

// --- DESIGN 7: REFINED ATHLETIC (LIGHT) ---
// Clean card grid, search in nav, content starts immediately.
// No marketing copy. Utilitarian header. Green accents on white.

const STATUS_STYLE: Record<string, string> = {
  open: "text-emerald-600 border-emerald-200 bg-emerald-50",
  filling: "text-amber-600 border-amber-200 bg-amber-50",
  full: "text-red-600 border-red-200 bg-red-50",
  closed: "text-gray-500 border-gray-200 bg-gray-50",
};

function Card({ tournament }: { tournament: Tournament }) {
  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="group relative block overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-300 hover:border-green-300 hover:shadow-lg hover:shadow-green-50"
    >
      <div className="h-0.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[tournament.registration_status ?? "open"]}`}
          >
            {tournament.registration_status ?? "open"}
          </span>
          {tournament.entry_fee != null && (
            <span className="font-mono text-lg font-bold text-gray-900">
              {formatCurrency(tournament.entry_fee)}
            </span>
          )}
        </div>

        <h3 className="mb-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-green-600">
          {tournament.name}
        </h3>

        <div className="space-y-1.5 text-sm">
          <p className="flex items-center gap-2 text-gray-500">
            <svg
              className="h-3.5 w-3.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {formatDateRange(tournament.date_start, tournament.date_end)}
          </p>
          <p className="flex items-center gap-2 text-gray-500">
            <svg
              className="h-3.5 w-3.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {tournament.location_name}
          </p>
        </div>

        {tournament.skill_levels && tournament.skill_levels.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tournament.skill_levels.map((s) => (
              <span
                key={s}
                className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function Design7() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [format, setFormat] = useState("");
  const debouncedSearch = useDebounce(search, 250);

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
    let result = tournaments;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.location_name.toLowerCase().includes(q)
      );
    }
    if (selectedSkills.length > 0) {
      result = result.filter((t) =>
        t.skill_levels?.some((s) => selectedSkills.includes(s))
      );
    }
    if (format) {
      result = result.filter((t) => t.format === format);
    }
    return result;
  }, [tournaments, debouncedSearch, selectedSkills, format]);

  const toggleSkill = (s: string) =>
    setSelectedSkills((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav — integrated with search, no separate hero */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/redesign/7" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
              <span className="text-base font-black text-white">P</span>
            </div>
            <span className="text-sm font-bold text-gray-700">PickleUp</span>
          </Link>

          {/* Search in nav */}
          <div className="relative hidden sm:block sm:w-72">
            <svg
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tournaments..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>
      </nav>

      {/* Mobile search */}
      <div className="border-b border-gray-200 px-6 py-3 sm:hidden">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tournaments..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-6 py-3">
          {SKILL_LEVELS.map((level) => {
            const active = selectedSkills.includes(level);
            return (
              <button
                key={level}
                onClick={() => toggleSkill(level)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                }`}
              >
                {level}
              </button>
            );
          })}

          <div className="mx-1 h-4 w-px bg-gray-200" />

          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-500 focus:border-green-500 focus:outline-none"
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-6 py-6">
        <p className="mb-5 text-xs text-gray-400">
          <span className="font-mono text-gray-600">{filtered.length}</span>{" "}
          tournament{filtered.length !== 1 ? "s" : ""}
        </p>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white py-20">
            <p className="font-medium text-gray-400">No tournaments found</p>
            <p className="mt-1 text-sm text-gray-400">
              Try adjusting your filters
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <Card key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-gradient-to-br from-green-500 to-emerald-600" />
            <span className="text-xs font-medium text-gray-400">PickleUp</span>
          </div>
          <p className="text-[11px] text-gray-300">
            PickleballBrackets &middot; Pickleball Den &middot; Community
          </p>
        </div>
      </footer>

      <DesignSwitcher />
    </div>
  );
}
