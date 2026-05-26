import type { Tournament, TournamentSource } from "@/lib/types";
import { formatDateRange, formatCurrency, relativeDate, googleMapsUrl } from "@/lib/format";
import { googleCalendarUrl, icsDataUrl } from "@/lib/calendar";
import { SOURCE_DISPLAY_NAMES } from "@/lib/constants";
import { ShareButtons } from "./share-buttons";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-green-50 text-green-700",
  filling: "bg-amber-50 text-amber-700",
  full: "bg-red-50 text-red-700",
  closed: "bg-gray-100 text-gray-500",
};

export function TournamentDetail({
  tournament,
  sources,
}: {
  tournament: Tournament;
  sources: TournamentSource[];
}) {
  const status = tournament.registration_status ?? "open";
  const withUrl = sources.filter((s) => s.registration_url);
  const relative = relativeDate(tournament.date_start);
  const mapsUrl = googleMapsUrl({
    latitude: tournament.latitude,
    longitude: tournament.longitude,
    address: tournament.location_address,
    name: tournament.location_name,
  });
  const hasSandbaggerAlert =
    tournament.max_sandbagger_pct != null && tournament.max_sandbagger_pct > 0;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[status]}`}
          >
            {status}
          </span>
          {relative && (
            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-600">
              {relative}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          {tournament.name}
        </h1>
        <p className="mt-2 text-base text-gray-500">
          {formatDateRange(tournament.date_start, tournament.date_end)}
          {" · "}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-green-600"
          >
            {tournament.location_name}
            {tournament.location_address && (
              <span className="ml-1 text-gray-400">
                — {tournament.location_address}
              </span>
            )}
          </a>
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Entry fee */}
        {tournament.entry_fee != null && (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Entry Fee
            </p>
            <p className="mt-1 text-2xl font-extrabold text-green-600">
              {formatCurrency(tournament.entry_fee)}
            </p>
          </div>
        )}

        {/* Registered */}
        {tournament.total_registered != null && (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Registered
            </p>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">
              {tournament.total_registered}
            </p>
          </div>
        )}

        {/* Events */}
        {tournament.event_count != null && (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Events
            </p>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">
              {tournament.event_count}
            </p>
          </div>
        )}

        {/* Sandbagger alert */}
        {hasSandbaggerAlert && (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-2 ring-red-300">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
              Sandbagger Alert
            </p>
            <p className="mt-1 text-2xl font-extrabold text-red-600">
              {Math.round(tournament.max_sandbagger_pct!)}%
            </p>
          </div>
        )}
      </div>

      {/* Skill levels */}
      {tournament.skill_levels && tournament.skill_levels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tournament.skill_levels.map((s) => (
            <span
              key={s}
              className="rounded-full bg-green-50 px-2.5 py-0.5 text-sm font-medium text-green-700"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Register CTA + utility buttons */}
      <div className="space-y-3">
        {withUrl.length > 0 && (
          <div className="space-y-2">
            {withUrl.map((source) => (
              <a
                key={source.id}
                href={source.registration_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-green-700"
              >
                Register on{" "}
                {SOURCE_DISPLAY_NAMES[source.source_platform] ??
                  source.source_platform}{" "}
                <span aria-hidden>{"↗"}</span>
              </a>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
          >
            {/* Map pin icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-gray-400"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 15.357 17 12.76 17 9.5a7 7 0 10-14 0c0 3.26 1.698 5.857 3.354 7.084.83.799 1.654 1.381 2.274 1.765.31.193.57.337.757.433a5.741 5.741 0 00.281.14l.018.008.006.003zM10 11.5a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            Map
          </a>

          <a
            href={googleCalendarUrl(tournament)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
          >
            {/* Calendar icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-gray-400"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
                clipRule="evenodd"
              />
            </svg>
            Cal
          </a>

          <a
            href={icsDataUrl(tournament)}
            download={`${tournament.name.replace(/[^a-zA-Z0-9]/g, "-")}.ics`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
          >
            {/* Download icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-gray-400"
              aria-hidden="true"
            >
              <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
            .ics
          </a>

          <div className="flex flex-1 items-center justify-center">
            <ShareButtons tournamentId={tournament.id} />
          </div>
        </div>
      </div>

      {/* Description */}
      {tournament.description && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
            About this tournament
          </h3>
          <p className="whitespace-pre-line text-base leading-relaxed text-gray-700">
            {tournament.description}
          </p>
        </div>
      )}
    </div>
  );
}
