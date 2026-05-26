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
    <div className="py-10 sm:py-12">
      {/* Tournament name */}
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
        {tournament.name}
      </h1>

      {/* Date + venue row */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xl text-gray-500 font-medium">
          {formatDateRange(tournament.date_start, tournament.date_end)}
        </span>
        <span className="text-gray-300 text-xl">·</span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xl text-gray-500 font-medium hover:text-emerald-700 hover:underline underline-offset-2"
        >
          {tournament.location_name}
        </a>
        {relative && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
            {relative}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="mt-8 flex flex-wrap gap-10">
        {tournament.entry_fee != null && (
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-extrabold text-emerald-800">
              {formatCurrency(tournament.entry_fee)}
            </span>
            <span className="text-xs uppercase tracking-widest text-gray-400">Entry Fee</span>
          </div>
        )}
        {(tournament.total_registered ?? 0) > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-extrabold text-gray-900">
              {tournament.total_registered}
            </span>
            <span className="text-xs uppercase tracking-widest text-gray-400">Registered</span>
          </div>
        )}
        {(tournament.event_count ?? 0) > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-extrabold text-gray-900">
              {tournament.event_count}
            </span>
            <span className="text-xs uppercase tracking-widest text-gray-400">Events</span>
          </div>
        )}
        {tournament.max_sandbagger_pct != null && tournament.max_sandbagger_pct > 0.2 && (
          <div className="flex flex-col gap-1">
            <span className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-bold text-red-700">
              ⚠ Sandbagger Alert
            </span>
          </div>
        )}
      </div>

      {/* Register button + utility links */}
      {withUrl.length > 0 && (
        <div className="mt-8 flex flex-col items-start gap-3">
          <div className="flex flex-wrap gap-3">
            {withUrl.map((source) => (
              <a
                key={source.id}
                href={source.registration_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-8 py-4 text-lg font-bold text-white transition hover:bg-emerald-800 whitespace-nowrap"
              >
                Register on {SOURCE_DISPLAY_NAMES[source.source_platform] ?? source.source_platform} ↗
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 hover:underline">
              Map
            </a>
            <span>·</span>
            <a href={googleCalendarUrl(tournament)} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 hover:underline">
              Add to Cal
            </a>
            <span>·</span>
            <ShareButtons
              tournamentId={tournament.id}
              tournamentName={tournament.name}
              dateRange={formatDateRange(tournament.date_start, tournament.date_end)}
              venue={tournament.location_name}
              registered={tournament.total_registered ?? undefined}
              eventCount={tournament.event_count ?? undefined}
              sandbaggerAlert={tournament.max_sandbagger_pct != null && tournament.max_sandbagger_pct > 0.2}
              liveRatings={tournament.total_live_dupr ?? undefined}
            />
          </div>
        </div>
      )}

      {/* Description */}
      {tournament.description && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-500">
            {tournament.description}
          </p>
        </div>
      )}
    </div>
  );
}
