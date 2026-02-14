"use client";

import { useState } from "react";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { SOURCE_DISPLAY_NAMES } from "@/lib/constants";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-50 text-green-600",
  pending_review: "bg-amber-50 text-amber-600",
  duplicate: "bg-gray-100 text-gray-500",
};

const SOURCE_OPTIONS = [
  { value: "", label: "All Sources" },
  { value: "pickleballbrackets", label: "PickleballBrackets" },
  { value: "pickleball_den", label: "Pickleball Den" },
  { value: "manual", label: "Direct Link" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "pending_review", label: "Pending Review" },
  { value: "duplicate", label: "Duplicate" },
];

type Tournament = {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
  location_name: string;
  status: string;
  source_platform: string | null;
  latitude: number | null;
  longitude: number | null;
  entry_fee: number | null;
  created_at: string;
};

export function AdminTournamentsTable({
  tournaments,
}: {
  tournaments: Tournament[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const filtered = tournaments.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (sourceFilter && t.source_platform !== sourceFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">All Tournaments</h1>
        <p className="mt-1 text-sm text-gray-500">
          {filtered.length} tournament{filtered.length !== 1 && "s"}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Venue</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Geo</th>
              <th className="px-4 py-3 text-right">Fee</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className="border-b border-gray-50 last:border-0"
              >
                <td className="max-w-[260px] truncate px-4 py-2.5 font-medium text-gray-700">
                  <a
                    href={`/tournaments/${t.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-green-600 hover:underline"
                  >
                    {t.name}
                  </a>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                  {formatDateRange(t.date_start, t.date_end)}
                </td>
                <td className="max-w-[180px] truncate px-4 py-2.5 text-gray-500">
                  {t.location_name}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      STATUS_STYLES[t.status] ?? "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-500">
                  {t.source_platform
                    ? SOURCE_DISPLAY_NAMES[t.source_platform] ??
                      t.source_platform
                    : "\u2014"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      t.latitude != null && t.longitude != null
                        ? "bg-green-500"
                        : "bg-gray-300"
                    }`}
                  />
                </td>
                <td className="px-4 py-2.5 text-right text-gray-700">
                  {t.entry_fee != null ? formatCurrency(t.entry_fee) : "\u2014"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-400">
                  {timeAgo(t.created_at)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-gray-400"
                >
                  No tournaments match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
