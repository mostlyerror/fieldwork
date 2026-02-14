"use client";

import { useState, useTransition } from "react";
import {
  updateAndApproveTournament,
  rejectTournament,
} from "@/app/admin/(dashboard)/actions";
import {
  SKILL_LEVELS,
  FORMAT_OPTIONS,
  SOURCE_DISPLAY_NAMES,
} from "@/lib/constants";

interface Tournament {
  id: string;
  name: string;
  date_start: string;
  date_end: string | null;
  location_name: string;
  location_address: string | null;
  entry_fee: number | null;
  skill_levels: string[] | null;
  format: string | null;
  description: string | null;
  source_platform: string | null;
  source_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

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

export function PendingTournamentCard({
  tournament,
}: {
  tournament: Tournament;
}) {
  const [name, setName] = useState(tournament.name);
  const [dateStart, setDateStart] = useState(tournament.date_start);
  const [dateEnd, setDateEnd] = useState(tournament.date_end ?? "");
  const [locationName, setLocationName] = useState(tournament.location_name);
  const [locationAddress, setLocationAddress] = useState(
    tournament.location_address ?? ""
  );
  const [entryFee, setEntryFee] = useState(
    tournament.entry_fee?.toString() ?? ""
  );
  const [skillLevels, setSkillLevels] = useState<string[]>(
    tournament.skill_levels ?? []
  );
  const [format, setFormat] = useState(tournament.format ?? "");
  const [description, setDescription] = useState(tournament.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAction(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        window.location.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function toggleSkillLevel(level: string) {
    setSkillLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  const sourceName = tournament.source_platform
    ? SOURCE_DISPLAY_NAMES[tournament.source_platform] ??
      tournament.source_platform
    : null;

  const hasCoords =
    tournament.latitude != null && tournament.longitude != null;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition duration-200 hover:shadow-md hover:ring-green-200">
      <div className="flex gap-6">
        {/* Left column — editable fields */}
        <div className="min-w-0 flex-[3] space-y-3">
          {/* Name */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-lg font-bold text-gray-800 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
          />

          {/* Dates side by side */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Start
              </label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
              />
            </div>
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                End
              </label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
              />
            </div>
          </div>

          {/* Venue + Address */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Venue
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
              />
            </div>
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Address
              </label>
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
              />
            </div>
          </div>

          {/* Fee + Format */}
          <div className="flex gap-3">
            <div className="w-28">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Entry Fee
              </label>
              <input
                type="number"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
              />
            </div>
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
              >
                <option value="">None</option>
                {FORMAT_OPTIONS.filter((f) => f.value !== "").map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Skill Levels */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Skill Levels
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SKILL_LEVELS.map((level) => {
                const selected = skillLevels.includes(level);
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleSkillLevel(level)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                      selected
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm leading-relaxed text-gray-700 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>
        </div>

        {/* Right column — metadata + actions */}
        <div className="flex w-52 shrink-0 flex-col justify-between">
          <div className="space-y-3">
            {/* Source */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Source
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                {sourceName && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    {sourceName}
                  </span>
                )}
              </div>
              {tournament.source_url ? (
                <a
                  href={tournament.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block truncate text-xs text-green-600 underline decoration-green-200 underline-offset-2 hover:text-green-700"
                >
                  {tournament.source_url}
                </a>
              ) : (
                <p className="mt-1 text-xs text-gray-400">No source link</p>
              )}
            </div>

            {/* Geocode status */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Geocode
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${hasCoords ? "bg-green-500" : "bg-amber-400"}`}
                />
                <span className="text-xs text-gray-600">
                  {hasCoords ? "Map ready" : "No coordinates"}
                </span>
              </div>
            </div>

            {/* Submitted */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Submitted
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                {timeAgo(tournament.created_at)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() =>
                handleAction(() =>
                  updateAndApproveTournament(tournament.id, {
                    name,
                    date_start: dateStart,
                    date_end: dateEnd || null,
                    location_name: locationName,
                    location_address: locationAddress || null,
                    entry_fee: entryFee ? Number(entryFee) : null,
                    skill_levels: skillLevels.length > 0 ? skillLevels : null,
                    format: format || null,
                    description: description || null,
                  })
                )
              }
              disabled={isPending}
              className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Approve"}
            </button>
            <button
              onClick={() =>
                handleAction(() => rejectTournament(tournament.id))
              }
              disabled={isPending}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-red-600 ring-1 ring-gray-200 transition hover:ring-red-300 disabled:opacity-50"
            >
              Reject
            </button>
          </div>

          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
