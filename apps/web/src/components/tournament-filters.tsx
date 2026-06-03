"use client";

import type { TournamentFilters as Filters, FieldStrengthFilter } from "@/lib/types";
import { SegmentedControl } from "./ui/segmented-control";

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
        className="t-small w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 placeholder-gray-400 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
      />
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <span className="t-label shrink-0 text-gray-400">Field</span>
        <SegmentedControl<FieldStrengthFilter>
          ariaLabel="Field strength filter"
          className="shrink-0"
          value={filters.fieldStrength}
          onChange={(v) => onChange({ ...filters, fieldStrength: v })}
          options={FIELD_STRENGTH_OPTIONS}
        />
      </div>
    </div>
  );
}
