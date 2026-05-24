"use client";

import type { TournamentFilters as Filters } from "@/lib/types";

export function TournamentFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  return (
    <input
      type="text"
      placeholder="Search tournaments..."
      aria-label="Search tournaments"
      value={filters.search}
      onChange={(e) => onChange({ ...filters, search: e.target.value })}
      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
    />
  );
}
