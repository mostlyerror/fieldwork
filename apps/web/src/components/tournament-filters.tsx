"use client";

import { SKILL_LEVELS, FORMAT_OPTIONS } from "@/lib/constants";
import type { TournamentFilters as Filters } from "@/lib/types";

export function TournamentFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const toggleSkill = (level: string) => {
    const next = filters.skillLevels.includes(level)
      ? filters.skillLevels.filter((s) => s !== level)
      : [...filters.skillLevels, level];
    onChange({ ...filters, skillLevels: next });
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search tournaments..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm placeholder-gray-400 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
      />

      <div className="flex flex-wrap items-end gap-4">
        {/* Date range */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <label className="text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        {/* Format */}
        <select
          value={filters.format}
          onChange={(e) => onChange({ ...filters, format: e.target.value })}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          {FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Skill level pills */}
      <div className="flex flex-wrap gap-1.5">
        {SKILL_LEVELS.map((level) => {
          const active = filters.skillLevels.includes(level);
          return (
            <button
              key={level}
              onClick={() => toggleSkill(level)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                active
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
              }`}
            >
              {level}
            </button>
          );
        })}
      </div>
    </div>
  );
}
