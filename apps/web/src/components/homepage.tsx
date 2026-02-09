"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { SKILL_LEVELS } from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const statusEmoji: Record<string, string> = {
    open: "\u{1F7E2}",
    filling: "\u{1F7E1}",
    full: "\u{1F534}",
    closed: "\u26AB",
  };

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="group block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-green-200"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          {formatDateRange(tournament.date_start, tournament.date_end)}
        </span>
        <span title={tournament.registration_status ?? "open"}>
          {statusEmoji[tournament.registration_status ?? "open"] ?? "\u{1F7E2}"}
        </span>
      </div>

      <h3 className="mb-1 text-lg font-bold text-gray-800 group-hover:text-green-700">
        {tournament.name}
      </h3>

      <p className="mb-3 flex items-center gap-1.5 text-sm text-gray-500">
        <span>{"\u{1F4CD}"}</span> {tournament.location_name}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {tournament.skill_levels?.slice(0, 4).map((s) => (
            <span
              key={s}
              className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700"
            >
              {s}
            </span>
          ))}
          {(tournament.skill_levels?.length ?? 0) > 4 && (
            <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-400">
              +{(tournament.skill_levels?.length ?? 0) - 4}
            </span>
          )}
        </div>
        {tournament.entry_fee != null && (
          <span className="text-sm font-bold text-green-600">
            {formatCurrency(tournament.entry_fee)}
          </span>
        )}
      </div>
    </Link>
  );
}

export function Homepage({ tournaments }: { tournaments: Tournament[] }) {
  const [search, setSearch] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const debouncedSearch = useDebounce(search, 250);

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
    return result;
  }, [tournaments, debouncedSearch, selectedSkills]);

  const toggleSkill = (s: string) =>
    setSelectedSkills((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">{"\u{1F3D3}"}</span>
            <div>
              <span className="block text-xl font-bold text-green-700">
                PickleUp
              </span>
              <span className="block text-[11px] text-gray-400">
                Your Houston pickleball community
              </span>
            </div>
          </Link>
        </div>
      </nav>

      {/* Welcome section */}
      <header className="px-5 pb-8 pt-12 text-center">
        <p className="mb-2 text-sm text-green-600">Hey there! {"\u{1F44B}"}</p>
        <h1 className="mx-auto max-w-lg text-3xl font-bold text-gray-800 md:text-4xl">
          Ready to play? Here&apos;s what&apos;s coming up in Houston
        </h1>
        <p className="mx-auto mt-3 max-w-md text-gray-500">
          We pull tournaments from across the web so you never miss one.
        </p>
      </header>

      {/* Search + filters */}
      <div className="mx-auto max-w-6xl px-5 pb-8">
        <div className="mx-auto max-w-xl">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
              {"\u{1F50D}"}
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or venue..."
              className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm shadow-sm placeholder-gray-300 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SKILL_LEVELS.map((level) => {
              const active = selectedSkills.includes(level);
              return (
                <button
                  key={level}
                  onClick={() => toggleSkill(level)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-green-600 text-white shadow-sm"
                      : "bg-white text-gray-500 ring-1 ring-gray-200 hover:ring-green-300"
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cards */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <p className="mb-4 text-center text-sm text-gray-400">
          {filtered.length} tournament{filtered.length !== 1 ? "s" : ""} found
        </p>
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-16 text-center shadow-sm">
            <p className="text-4xl">{"\u{1F3D3}"}</p>
            <p className="mt-4 text-lg font-bold text-gray-300">
              No matches right now
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Try a different search or check back soon!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white/60 py-8 text-center">
        <p className="text-sm text-gray-400">
          Made with {"\u{1F49A}"} for the Houston pickleball community
        </p>
      </footer>
    </div>
  );
}
