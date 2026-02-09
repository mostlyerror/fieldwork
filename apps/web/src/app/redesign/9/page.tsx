"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { SKILL_LEVELS, FORMAT_OPTIONS } from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";
import DesignSwitcher from "@/components/design-switcher";

// --- DESIGN 9: COMPACT ROWS (LIGHT) ---
// Maximum info per scroll distance. Each tournament is a single styled row
// with all key data points visible: date, name, location, skills, fee, status.

const STATUS_COLORS: Record<string, string> = {
  open: "text-emerald-600 bg-emerald-50",
  filling: "text-amber-600 bg-amber-50",
  full: "text-red-600 bg-red-50",
  closed: "text-gray-500 bg-gray-100",
};

function TournamentRow({ tournament }: { tournament: Tournament }) {
  const status = tournament.registration_status ?? "open";
  const dateObj = new Date(tournament.date_start + "T00:00:00");
  const month = dateObj
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  const day = dateObj.getDate();
  const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="group flex items-center gap-4 border-b border-gray-100 px-4 py-3 transition-colors hover:bg-emerald-50/50 sm:gap-5"
    >
      {/* Date — compact block */}
      <div className="flex w-12 flex-shrink-0 flex-col items-center">
        <span className="text-[9px] font-semibold tracking-wider text-gray-400">
          {month}
        </span>
        <span className="text-xl font-light leading-tight text-gray-800">
          {day}
        </span>
        <span className="text-[9px] text-gray-400">{weekday}</span>
      </div>

      {/* Name + location */}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-gray-800 transition-colors group-hover:text-emerald-600">
          {tournament.name}
        </h3>
        <p className="mt-0.5 truncate text-xs text-gray-400">
          {tournament.location_name}
        </p>
      </div>

      {/* Skills — inline pills */}
      <div className="hidden flex-shrink-0 gap-1 lg:flex">
        {tournament.skill_levels && tournament.skill_levels.length > 0 ? (
          tournament.skill_levels.slice(0, 4).map((s) => (
            <span
              key={s}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
            >
              {s}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-gray-300">All levels</span>
        )}
        {tournament.skill_levels && tournament.skill_levels.length > 4 && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            +{tournament.skill_levels.length - 4}
          </span>
        )}
      </div>

      {/* Format */}
      <div className="hidden w-24 flex-shrink-0 text-right md:block">
        <span className="text-xs text-gray-400">
          {tournament.format
            ? tournament.format.replace(/_/g, " ")
            : "—"}
        </span>
      </div>

      {/* Fee */}
      <div className="w-14 flex-shrink-0 text-right">
        <span className="text-sm font-semibold text-gray-700">
          {tournament.entry_fee != null
            ? formatCurrency(tournament.entry_fee)
            : "—"}
        </span>
      </div>

      {/* Status */}
      <div className="w-16 flex-shrink-0 text-right">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_COLORS[status]}`}
        >
          {status}
        </span>
      </div>

      {/* Arrow */}
      <span className="flex-shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-500">
        ›
      </span>
    </Link>
  );
}

export default function Design9() {
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="border-b border-gray-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/redesign/9" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500">
              <span className="text-xs font-black text-white">P</span>
            </div>
            <span className="text-sm font-bold text-gray-900">PickleUp</span>
          </Link>

          {/* Search in nav */}
          <div className="relative hidden sm:block sm:w-60">
            <svg
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
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
              placeholder="Search..."
              className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </nav>

      {/* Mobile search */}
      <div className="border-b border-gray-200 px-4 py-2.5 sm:hidden">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
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
            placeholder="Search..."
            className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 bg-gray-50/50">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1.5 px-4 py-2.5 sm:px-6">
          {SKILL_LEVELS.map((level) => {
            const active = selectedSkills.includes(level);
            return (
              <button
                key={level}
                onClick={() => toggleSkill(level)}
                className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                  active
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                }`}
              >
                {level}
              </button>
            );
          })}
          <div className="mx-1 h-3.5 w-px bg-gray-200" />
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-500 focus:border-emerald-500 focus:outline-none"
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Column headers */}
      <div className="border-b border-gray-100 bg-gray-50">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:gap-5 sm:px-6">
          <span className="w-12 flex-shrink-0 text-center">Date</span>
          <span className="min-w-0 flex-1">Tournament</span>
          <span className="hidden lg:block">Levels</span>
          <span className="hidden w-24 flex-shrink-0 text-right md:block">
            Format
          </span>
          <span className="w-14 flex-shrink-0 text-right">Fee</span>
          <span className="w-16 flex-shrink-0 text-right">Status</span>
          <span className="w-3 flex-shrink-0" />
        </div>
      </div>

      {/* List */}
      <section className="mx-auto max-w-5xl">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20">
            <p className="text-sm text-gray-400">No tournaments found</p>
            <p className="mt-1 text-xs text-gray-400">
              Try adjusting your filters
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((t) => (
              <TournamentRow key={t.id} tournament={t} />
            ))}
          </div>
        )}

        <p className="px-4 py-4 text-xs text-gray-400 sm:px-6">
          <span className="font-mono text-gray-500">{filtered.length}</span>{" "}
          tournament{filtered.length !== 1 ? "s" : ""}
        </p>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="text-[11px] text-gray-400">PickleUp</span>
          <span className="text-[11px] text-gray-300">
            PickleballBrackets &middot; Pickleball Den
          </span>
        </div>
      </footer>

      <DesignSwitcher />
    </div>
  );
}
