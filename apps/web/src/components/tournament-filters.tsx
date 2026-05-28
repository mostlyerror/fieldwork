"use client";

import type { TournamentFilters as Filters, FieldStrengthFilter } from "@/lib/types";

const FIELD_STRENGTH_OPTIONS: { value: FieldStrengthFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "friendly", label: "Friendly" },
  { value: "competitive", label: "Competitive" },
  { value: "stacked", label: "Stacked" },
];

export function TournamentFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search tournaments..."
        aria-label="Search tournaments"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-gray-400">Field:</span>
        {FIELD_STRENGTH_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, fieldStrength: opt.value })}
            className={`rounded-full min-h-[36px] px-3.5 py-1.5 text-xs font-semibold transition sm:min-h-0 sm:py-1 ${
              filters.fieldStrength === opt.value
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
