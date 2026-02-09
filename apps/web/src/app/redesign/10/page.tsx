"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { SKILL_LEVELS, FORMAT_OPTIONS } from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";
import DesignSwitcher from "@/components/design-switcher";

// --- DESIGN 10: SPLIT PANEL (LIGHT) ---
// Left: compact scrollable list. Right: detailed preview of selected tournament.
// Best of both worlds — fast scanning + full detail without navigating away.
// On mobile, falls back to a single list view.

const STATUS_COLORS: Record<string, string> = {
  open: "text-emerald-600",
  filling: "text-amber-600",
  full: "text-red-600",
  closed: "text-gray-400",
};

const STATUS_BG: Record<string, string> = {
  open: "bg-emerald-50 border-emerald-200",
  filling: "bg-amber-50 border-amber-200",
  full: "bg-red-50 border-red-200",
  closed: "bg-gray-50 border-gray-200",
};

function ListItem({
  tournament,
  isSelected,
  onClick,
}: {
  tournament: Tournament;
  isSelected: boolean;
  onClick: () => void;
}) {
  const status = tournament.registration_status ?? "open";
  const dateObj = new Date(tournament.date_start + "T00:00:00");
  const dateShort = dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <button
      onClick={onClick}
      className={`w-full border-b border-gray-100 px-4 py-3 text-left transition-colors ${
        isSelected
          ? "border-l-2 border-l-emerald-500 bg-emerald-50/50"
          : "border-l-2 border-l-transparent hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className={`text-sm font-semibold leading-tight ${
            isSelected ? "text-emerald-700" : "text-gray-800"
          }`}
        >
          {tournament.name}
        </h3>
        <span
          className={`flex-shrink-0 text-[10px] font-bold uppercase ${STATUS_COLORS[status]}`}
        >
          {status}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
        <span>{dateShort}</span>
        <span className="truncate">{tournament.location_name}</span>
        {tournament.entry_fee != null && (
          <span className="flex-shrink-0 font-medium text-gray-600">
            {formatCurrency(tournament.entry_fee)}
          </span>
        )}
      </div>
    </button>
  );
}

function DetailPanel({ tournament }: { tournament: Tournament }) {
  const status = tournament.registration_status ?? "open";

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Status + fee header */}
      <div className="flex items-center justify-between">
        <span
          className={`rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_COLORS[status]} ${STATUS_BG[status]}`}
        >
          {status}
        </span>
        {tournament.entry_fee != null && (
          <span className="text-2xl font-bold text-gray-900">
            {formatCurrency(tournament.entry_fee)}
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="mt-4 text-xl font-bold text-gray-900">{tournament.name}</h2>

      {/* Details grid */}
      <div className="mt-6 space-y-4">
        <div className="flex items-start gap-3">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400"
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
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Date
            </p>
            <p className="text-sm text-gray-800">
              {formatDateRange(tournament.date_start, tournament.date_end)}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400"
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
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Location
            </p>
            <p className="text-sm text-gray-800">
              {tournament.location_name}
            </p>
            {tournament.location_address && (
              <p className="text-xs text-gray-500">
                {tournament.location_address}
              </p>
            )}
          </div>
        </div>

        {tournament.format && (
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Format
              </p>
              <p className="text-sm text-gray-800">
                {tournament.format.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Skill levels */}
      {tournament.skill_levels && tournament.skill_levels.length > 0 && (
        <div className="mt-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Skill Levels
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tournament.skill_levels.map((s) => (
              <span
                key={s}
                className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {tournament.description && (
        <div className="mt-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Description
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
            {tournament.description}
          </p>
        </div>
      )}

      {/* Action */}
      <div className="mt-8 flex gap-3">
        <Link
          href={`/tournaments/${tournament.id}`}
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
        >
          View Details
        </Link>
        {tournament.registration_url && (
          <a
            href={tournament.registration_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900"
          >
            Register
          </a>
        )}
      </div>
    </div>
  );
}

export default function Design10() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [format, setFormat] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      .then((data) => {
        setTournaments(data ?? []);
        if (data?.length > 0) setSelectedId(data[0].id);
      })
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

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedId) ?? null,
    [tournaments, selectedId]
  );

  const toggleSkill = (s: string) =>
    setSelectedSkills((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <nav className="flex-shrink-0 border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/redesign/10" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500">
              <span className="text-xs font-black text-white">P</span>
            </div>
            <span className="text-sm font-bold text-gray-900">PickleRadar</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block sm:w-52">
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

            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-500 focus:border-emerald-500 focus:outline-none"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-1 border-t border-gray-100 px-4 py-2">
          {SKILL_LEVELS.map((level) => {
            const active = selectedSkills.includes(level);
            return (
              <button
                key={level}
                onClick={() => toggleSkill(level)}
                className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
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

        {/* Mobile search */}
        <div className="border-t border-gray-100 px-4 py-2 sm:hidden">
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
      </nav>

      {/* Split panel — list + detail */}
      <div className="flex min-h-0 flex-1">
        {/* Left: list */}
        <div className="w-full overflow-y-auto border-r border-gray-200 md:w-96 lg:w-[420px]">
          <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {filtered.length} tournament{filtered.length !== 1 ? "s" : ""}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <p className="text-sm text-gray-400">No tournaments found</p>
            </div>
          ) : (
            filtered.map((t) => (
              <ListItem
                key={t.id}
                tournament={t}
                isSelected={t.id === selectedId}
                onClick={() => setSelectedId(t.id)}
              />
            ))
          )}
        </div>

        {/* Right: detail (hidden on mobile) */}
        <div className="hidden flex-1 bg-gray-50/50 md:block">
          {selectedTournament ? (
            <DetailPanel tournament={selectedTournament} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-400">
                Select a tournament to view details
              </p>
            </div>
          )}
        </div>
      </div>

      <DesignSwitcher />
    </div>
  );
}
