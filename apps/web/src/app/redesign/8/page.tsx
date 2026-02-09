"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { SKILL_LEVELS, FORMAT_OPTIONS } from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";
import DesignSwitcher from "@/components/design-switcher";

// --- DESIGN 8: INFO-DENSE CARDS (LIGHT) ---
// Every data point visible at a glance — no click-through needed.
// Status, fee, dates, location, skill levels, format all on the card.

const STATUS_DOT: Record<string, string> = {
  open: "bg-emerald-500",
  filling: "bg-amber-500",
  full: "bg-red-500",
  closed: "bg-gray-400",
};

const STATUS_TEXT: Record<string, string> = {
  open: "text-emerald-600",
  filling: "text-amber-600",
  full: "text-red-600",
  closed: "text-gray-500",
};

function RichCard({ tournament }: { tournament: Tournament }) {
  const status = tournament.registration_status ?? "open";
  const dateObj = new Date(tournament.date_start + "T00:00:00");
  const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="group block rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-50"
    >
      {/* Top bar: status + fee */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
          <span
            className={`text-[11px] font-semibold uppercase tracking-wide ${STATUS_TEXT[status]}`}
          >
            {status}
          </span>
        </div>
        <span className="text-sm font-bold text-gray-900">
          {tournament.entry_fee != null
            ? formatCurrency(tournament.entry_fee)
            : "—"}
        </span>
      </div>

      {/* Main content */}
      <div className="px-4 py-3.5">
        <h3 className="text-[15px] font-semibold text-gray-900 transition-colors group-hover:text-emerald-600">
          {tournament.name}
        </h3>

        <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">When</span>
            <span className="text-gray-700">
              {weekday},{" "}
              {formatDateRange(tournament.date_start, tournament.date_end)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Where</span>
            <span className="truncate text-gray-700">
              {tournament.location_name}
            </span>
          </div>
          {tournament.format && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Format</span>
              <span className="text-gray-700">
                {tournament.format.replace(/_/g, " ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar: skill levels */}
      {tournament.skill_levels && tournament.skill_levels.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-gray-100 px-4 py-2.5">
          {tournament.skill_levels.map((s) => (
            <span
              key={s}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500"
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export default function Design8() {
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
      {/* Header */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/redesign/8" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
              <span className="text-sm font-black text-white">P</span>
            </div>
            <span className="text-sm font-bold text-gray-900">PickleUp</span>
          </Link>
          <span className="text-xs text-gray-400">Houston, TX</span>
        </div>
      </nav>

      {/* Search + filters */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
                placeholder="Search by name or location..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-500 focus:border-emerald-500 focus:outline-none"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {SKILL_LEVELS.map((level) => {
              const active = selectedSkills.includes(level);
              return (
                <button
                  key={level}
                  onClick={() => toggleSkill(level)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      <section className="mx-auto max-w-6xl px-6 py-6">
        <p className="mb-4 text-xs text-gray-400">
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <RichCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-emerald-500" />
            <span className="text-xs text-gray-400">PickleUp</span>
          </div>
        </div>
      </footer>

      <DesignSwitcher />
    </div>
  );
}
