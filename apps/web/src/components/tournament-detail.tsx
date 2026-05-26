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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="p-6 sm:p-8">
        {/* Name — big and bold */}
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          {tournament.name}
        </h1>

        {/* Date · Venue · Badge */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-lg font-semibold text-gray-700">
            {formatDateRange(tournament.date_start, tournament.date_end)}
          </span>
          <span className="text-gray-300">·</span>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg text-gray-500 hover:text-emerald-700 hover:underline underline-offset-2"
          >
            {tournament.location_name}
          </a>
          {relative && (
            <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-700">
              {relative}
            </span>
          )}
        </div>

        {/* Stat row — lightweight but scannable */}
        <div className="mt-6 flex flex-wrap gap-6 text-sm">
          {tournament.entry_fee != null && (
            <div>
              <span className="text-gray-400">Entry </span>
              <span className="text-lg font-extrabold text-emerald-800">{formatCurrency(tournament.entry_fee)}</span>
            </div>
          )}
          {(tournament.total_registered ?? 0) > 0 && (
            <div>
              <span className="text-gray-400">Registered </span>
              <span className="text-lg font-extrabold text-gray-900">{tournament.total_registered}</span>
            </div>
          )}
          {(tournament.event_count ?? 0) > 0 && (
            <div>
              <span className="text-gray-400">Events </span>
              <span className="text-lg font-extrabold text-gray-900">{tournament.event_count}</span>
            </div>
          )}
          {tournament.max_sandbagger_pct != null && tournament.max_sandbagger_pct > 0.2 && (
            <div>
              <span className="text-red-500">⚠ Sandbagger </span>
              <span className="text-lg font-extrabold text-red-600">{Math.round(tournament.max_sandbagger_pct * 100)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Register CTA — prominent but not garish, anchored to bottom of card */}
      {withUrl.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-4 sm:px-8">
          {withUrl.map((source) => (
            <a
              key={source.id}
              href={source.registration_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 py-3.5 text-base font-bold text-white transition hover:bg-emerald-800"
            >
              Register on {SOURCE_DISPLAY_NAMES[source.source_platform] ?? source.source_platform} ↗
            </a>
          ))}
          <div className="mt-3 flex items-center justify-center gap-4 text-sm text-gray-400">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 hover:underline">
              Map
            </a>
            <span>·</span>
            <a href={googleCalendarUrl(tournament)} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 hover:underline">
              Add to Cal
            </a>
            <span>·</span>
            <ShareButtons tournamentId={tournament.id} />
          </div>
        </div>
      )}

      {/* Description */}
      {tournament.description && (
        <div className="border-t border-gray-100 px-6 py-5 sm:px-8">
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-500">
            {tournament.description}
          </p>
        </div>
      )}
    </div>
  );
}
