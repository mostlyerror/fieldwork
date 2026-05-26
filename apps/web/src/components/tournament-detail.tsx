import type { Tournament, TournamentSource } from "@/lib/types";
import { formatDateRange, formatCurrency, relativeDate, googleMapsUrl } from "@/lib/format";
import { googleCalendarUrl } from "@/lib/calendar";
import { SOURCE_DISPLAY_NAMES } from "@/lib/constants";
import { ShareButtons } from "./share-buttons";

export function TournamentDetail({
  tournament,
  sources,
}: {
  tournament: Tournament;
  sources: TournamentSource[];
}) {
  const withUrl = sources.filter((s) => s.registration_url);
  const relative = relativeDate(tournament.date_start);
  const mapsUrl = googleMapsUrl({
    latitude: tournament.latitude,
    longitude: tournament.longitude,
    address: tournament.location_address,
    name: tournament.location_name,
  });

  return (
    <div className="space-y-10">
      {/* Hero header — big name, clear subtitle */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          {tournament.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-gray-500">
          <span className="font-medium text-gray-700">
            {formatDateRange(tournament.date_start, tournament.date_end)}
          </span>
          <span className="text-gray-300">|</span>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-emerald-600 hover:underline"
          >
            {tournament.location_name}
          </a>
          {relative && (
            <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-700">
              {relative}
            </span>
          )}
        </div>
      </div>

      {/* Key numbers — big, scannable */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tournament.entry_fee != null && (
          <div className="rounded-2xl bg-white px-5 py-5 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Entry</p>
            <p className="mt-2 text-3xl font-extrabold text-emerald-600">
              {formatCurrency(tournament.entry_fee)}
            </p>
          </div>
        )}
        {(tournament.total_registered ?? 0) > 0 && (
          <div className="rounded-2xl bg-white px-5 py-5 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Registered</p>
            <p className="mt-2 text-3xl font-extrabold text-gray-900">
              {tournament.total_registered}
            </p>
          </div>
        )}
        {(tournament.event_count ?? 0) > 0 && (
          <div className="rounded-2xl bg-white px-5 py-5 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Events</p>
            <p className="mt-2 text-3xl font-extrabold text-gray-900">
              {tournament.event_count}
            </p>
          </div>
        )}
        {tournament.max_sandbagger_pct != null && tournament.max_sandbagger_pct > 0.2 && (
          <div className="rounded-2xl bg-red-50 px-5 py-5 text-center shadow-sm ring-2 ring-red-200">
            <p className="text-[11px] font-bold uppercase tracking-widest text-red-500">⚠️ Alerts</p>
            <p className="mt-2 text-3xl font-extrabold text-red-600">
              {Math.round(tournament.max_sandbagger_pct * 100)}%
            </p>
          </div>
        )}
      </div>

      {/* Actions — register + quick links */}
      <div className="space-y-3">
        {withUrl.map((source) => (
          <a
            key={source.id}
            href={source.registration_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-bold text-white shadow-md transition hover:bg-emerald-700"
          >
            Register on {SOURCE_DISPLAY_NAMES[source.source_platform] ?? source.source_platform} ↗
          </a>
        ))}
        <div className="flex gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl bg-white py-2.5 text-center text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50"
          >
            📍 Map
          </a>
          <a
            href={googleCalendarUrl(tournament)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl bg-white py-2.5 text-center text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50"
          >
            📅 Add to Cal
          </a>
          <div className="flex-1 rounded-xl bg-white py-2.5 text-center ring-1 ring-gray-200">
            <ShareButtons tournamentId={tournament.id} />
          </div>
        </div>
      </div>

      {/* Description — only if exists */}
      {tournament.description && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
            {tournament.description}
          </p>
        </div>
      )}
    </div>
  );
}
