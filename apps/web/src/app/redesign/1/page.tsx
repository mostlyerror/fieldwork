"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import DesignSwitcher from "@/components/design-switcher";

// --- DESIGN 1: BOLD EDITORIAL ---
// Magazine-style layout with oversized typography, dramatic whitespace,
// asymmetric grid, and bold color blocks.

function EditorialCard({ tournament, featured }: { tournament: Tournament; featured?: boolean }) {
  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className={`group relative block overflow-hidden ${featured ? "col-span-full md:col-span-2 row-span-2" : ""}`}
    >
      <div className={`relative border-l-4 border-green-500 bg-white p-6 transition-all duration-300 hover:bg-green-500 hover:text-white ${featured ? "min-h-[320px] flex flex-col justify-end" : ""}`}>
        {featured && (
          <div className="absolute right-6 top-6">
            <span className="font-mono text-8xl font-black text-green-100 transition-colors group-hover:text-white/20">
              {new Date(tournament.date_start + "T00:00:00").getDate()}
            </span>
          </div>
        )}

        <div className="relative z-10">
          <div className="mb-3 flex items-center gap-3">
            <span className={`inline-block rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
              tournament.registration_status === "open"
                ? "bg-green-100 text-green-800 group-hover:bg-white/20 group-hover:text-white"
                : tournament.registration_status === "filling"
                ? "bg-amber-100 text-amber-800 group-hover:bg-white/20 group-hover:text-white"
                : "bg-gray-100 text-gray-600 group-hover:bg-white/20 group-hover:text-white"
            }`}>
              {tournament.registration_status ?? "open"}
            </span>
            {tournament.entry_fee != null && (
              <span className="text-xs font-medium text-gray-400 group-hover:text-white/70">
                {formatCurrency(tournament.entry_fee)}
              </span>
            )}
          </div>

          <h3 className={`font-black leading-tight tracking-tight ${featured ? "text-3xl md:text-4xl" : "text-xl"}`}>
            {tournament.name}
          </h3>

          <div className={`mt-3 space-y-1 ${featured ? "text-base" : "text-sm"}`}>
            <p className="font-medium text-gray-600 group-hover:text-white/80">
              {formatDateRange(tournament.date_start, tournament.date_end)}
            </p>
            <p className="text-gray-400 group-hover:text-white/60">
              {tournament.location_name}
            </p>
          </div>

          {tournament.skill_levels && tournament.skill_levels.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1">
              {tournament.skill_levels.map((s) => (
                <span key={s} className="border border-gray-200 px-2 py-0.5 text-[10px] font-mono tracking-wider text-gray-500 group-hover:border-white/30 group-hover:text-white/70">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Design1() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Fetch tournaments on mount
  useMemo(() => {
    if (loaded) return;
    setLoaded(true);
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tournaments?status=eq.active&date_start=gte.${new Date().toISOString().split("T")[0]}&order=date_start.asc&select=*`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    })
      .then((r) => r.json())
      .then((data) => setTournaments(data ?? []))
      .catch(() => {});
  }, [loaded]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return tournaments;
    const q = debouncedSearch.toLowerCase();
    return tournaments.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.location_name.toLowerCase().includes(q)
    );
  }, [tournaments, debouncedSearch]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="border-b-2 border-black bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/redesign/1" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-green-500 text-xl font-black text-white">
              P
            </div>
            <div>
              <span className="block text-lg font-black uppercase tracking-tight">PickleUp</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.3em] text-gray-400">Houston TX</span>
            </div>
          </Link>
          <div className="hidden items-center gap-8 text-xs font-bold uppercase tracking-widest text-gray-400 md:flex">
            <span className="text-black">Tournaments</span>
            <span className="cursor-default">Map</span>
            <span className="cursor-default">About</span>
          </div>
        </div>
      </nav>

      {/* Hero section */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.4em] text-green-600">
            Houston-Area Pickleball
          </p>
          <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tighter md:text-7xl lg:text-8xl">
            Find Your
            <br />
            Next <span className="text-green-500">Tournament</span>
          </h1>
          <div className="mt-8 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tournaments, venues..."
              className="w-full border-b-2 border-black bg-transparent py-3 text-lg placeholder-gray-300 focus:border-green-500 focus:outline-none"
            />
          </div>
        </div>
      </header>

      {/* Tournament grid */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex items-baseline justify-between">
          <p className="font-mono text-sm text-gray-400">
            {filtered.length} upcoming {filtered.length === 1 ? "event" : "events"}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-2xl font-black text-gray-200">No tournaments found</p>
          </div>
        ) : (
          <div className="grid gap-px bg-gray-200 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t, i) => (
              <EditorialCard key={t.id} tournament={t} featured={i === 0} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-black bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              PickleUp &copy; {new Date().getFullYear()}
            </p>
            <p className="text-xs text-gray-300">
              &copy; {new Date().getFullYear()} PickleUp
            </p>
          </div>
        </div>
      </footer>

      <DesignSwitcher />
    </div>
  );
}
