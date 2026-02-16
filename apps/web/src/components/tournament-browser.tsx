"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Tournament, TournamentFilters as Filters } from "@/lib/types";
import { useDebounce } from "@/hooks/use-debounce";
import { useUserLocation } from "@/hooks/use-user-location";
import { distanceMiles } from "@/lib/format";
import { TournamentFilters } from "./tournament-filters";
import { TournamentList } from "./tournament-list";
import { ViewToggle, type ViewMode } from "./view-toggle";

const TournamentMap = dynamic(() => import("./tournament-map"), { ssr: false });

const EMPTY_FILTERS: Filters = {
  search: "",
  skillLevels: [],
};

export function TournamentBrowser({
  tournaments,
  citySlug,
}: {
  tournaments: Tournament[];
  citySlug?: string;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<ViewMode>("list");
  const [sortByDistance, setSortByDistance] = useState(false);
  const userLocation = useUserLocation();
  const debouncedSearch = useDebounce(filters.search, 250);

  const filtered = useMemo(() => {
    let result = tournaments;

    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.location_name.toLowerCase().includes(q) ||
          t.location_address?.toLowerCase().includes(q)
      );
    }

    // Skill levels
    if (filters.skillLevels.length > 0) {
      result = result.filter((t) =>
        t.skill_levels?.some((s) => filters.skillLevels.includes(s))
      );
    }

    // Sort
    if (sortByDistance && userLocation) {
      result = [...result].sort((a, b) => {
        const da =
          a.latitude != null && a.longitude != null
            ? distanceMiles(
                userLocation.latitude,
                userLocation.longitude,
                a.latitude,
                a.longitude
              )
            : Infinity;
        const db =
          b.latitude != null && b.longitude != null
            ? distanceMiles(
                userLocation.latitude,
                userLocation.longitude,
                b.latitude,
                b.longitude
              )
            : Infinity;
        return da - db;
      });
    }

    return result;
  }, [tournaments, debouncedSearch, filters, sortByDistance, userLocation]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <TournamentFilters filters={filters} onChange={setFilters} />
        </div>
        <div className="flex items-center gap-3 sm:flex-shrink-0 sm:pt-0.5">
          {userLocation && (
            <button
              onClick={() => setSortByDistance((d) => !d)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                sortByDistance
                  ? "border-green-600 bg-green-50 text-green-700"
                  : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
              }`}
            >
              Nearest first
            </button>
          )}
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      <p className="text-sm text-gray-500">
        {filtered.length} tournament{filtered.length !== 1 ? "s" : ""}
      </p>

      {view === "list" ? (
        <TournamentList tournaments={filtered} citySlug={citySlug} />
      ) : (
        <TournamentMap tournaments={filtered} citySlug={citySlug} />
      )}
    </div>
  );
}
