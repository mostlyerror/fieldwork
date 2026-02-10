import type { Tournament, TournamentSource } from "@/lib/types";
import { formatDateRange, formatCurrency, relativeDate, googleMapsUrl } from "@/lib/format";
import { googleCalendarUrl, icsDataUrl } from "@/lib/calendar";
import { SOURCE_DISPLAY_NAMES } from "@/lib/constants";
import { ShareButtons } from "./share-buttons";

const FORMAT_LABELS: Record<string, string> = {
  round_robin: "Round Robin",
  single_elim: "Single Elimination",
  double_elim: "Double Elimination",
  mixed: "Mixed",
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-green-50 text-green-700",
  filling: "bg-amber-50 text-amber-700",
  full: "bg-red-50 text-red-700",
  closed: "bg-gray-100 text-gray-500",
};

export function TournamentDetail({
  tournament,
  sources,
  miniMap,
}: {
  tournament: Tournament;
  sources: TournamentSource[];
  miniMap?: React.ReactNode;
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

  return (
    <>
      <h1 className="mb-8 text-4xl font-extrabold tracking-tight text-gray-900">
        {tournament.name}
      </h1>

      <div className="grid gap-8 md:grid-cols-[300px_1fr]">
        {/* Left sidebar — key facts */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            {/* Status */}
            <div className="mb-5">
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[status]}`}
              >
                {status}
              </span>
            </div>

            {/* Key facts */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Date
                </p>
                <p className="text-base font-bold text-gray-900">
                  {formatDateRange(tournament.date_start, tournament.date_end)}
                </p>
                {relative && (
                  <span className="mt-1 inline-block rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-600">
                    {relative}
                  </span>
                )}
                <div className="mt-1.5 flex gap-2 text-xs">
                  <a
                    href={googleCalendarUrl(tournament)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 underline decoration-gray-300 underline-offset-2 hover:text-green-600"
                  >
                    Google Cal
                  </a>
                  <a
                    href={icsDataUrl(tournament)}
                    download={`${tournament.name.replace(/[^a-zA-Z0-9]/g, "-")}.ics`}
                    className="text-gray-400 underline decoration-gray-300 underline-offset-2 hover:text-green-600"
                  >
                    .ics
                  </a>
                </div>
              </div>

              {tournament.entry_fee != null && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Entry Fee
                  </p>
                  <p className="text-2xl font-extrabold text-green-600">
                    {formatCurrency(tournament.entry_fee)}
                  </p>
                </div>
              )}

              {tournament.format && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Format
                  </p>
                  <p className="text-base font-bold text-gray-900">
                    {FORMAT_LABELS[tournament.format] ?? tournament.format}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Venue
                </p>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/venue"
                >
                  <p className="text-base font-bold text-gray-900 group-hover/venue:text-green-600">
                    {tournament.location_name}
                    <span className="ml-1 text-sm text-gray-300 group-hover/venue:text-green-500">
                      {"\u2197"}
                    </span>
                  </p>
                  {tournament.location_address && (
                    <p className="text-sm text-gray-500 group-hover/venue:text-green-500">
                      {tournament.location_address}
                    </p>
                  )}
                </a>
              </div>
            </div>

            {/* Skill levels */}
            {tournament.skill_levels && tournament.skill_levels.length > 0 && (
              <div className="mt-5 border-t border-gray-100 pt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Skill Levels
                </p>
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
              </div>
            )}

            {/* Register buttons */}
            {withUrl.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-gray-100 pt-5">
                {withUrl.map((source) => (
                  <a
                    key={source.id}
                    href={source.registration_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-green-700"
                  >
                    {SOURCE_DISPLAY_NAMES[source.source_platform] ??
                      source.source_platform}{" "}
                    <span aria-hidden>{"\u2197"}</span>
                  </a>
                ))}
              </div>
            )}

            {/* Share */}
            <div className="mt-5 border-t border-gray-100 pt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Share
              </p>
              <ShareButtons tournamentId={tournament.id} />
            </div>
          </div>
        </div>

        {/* Right — map + description */}
        <div className="space-y-6">
          {/* Map */}
          {miniMap && (
            <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-gray-100">
              {miniMap}
            </div>
          )}

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
      </div>
    </>
  );
}
