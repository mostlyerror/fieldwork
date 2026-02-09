import type { Tournament, TournamentSource } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { SOURCE_DISPLAY_NAMES } from "@/lib/constants";

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

  return (
    <>
      <h1 className="mb-8 text-3xl font-bold text-gray-800">
        {tournament.name}
      </h1>

      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        {/* Left sidebar — key facts */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            {/* Status */}
            <div className="mb-4">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}
              >
                {status}
              </span>
            </div>

            {/* Key facts */}
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Date
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {formatDateRange(tournament.date_start, tournament.date_end)}
                </p>
              </div>

              {tournament.entry_fee != null && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Entry Fee
                  </p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(tournament.entry_fee)}
                  </p>
                </div>
              )}

              {tournament.format && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Format
                  </p>
                  <p className="text-sm font-semibold text-gray-800">
                    {FORMAT_LABELS[tournament.format] ?? tournament.format}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Venue
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {tournament.location_name}
                </p>
                {tournament.location_address && (
                  <p className="text-xs text-gray-400">
                    {tournament.location_address}
                  </p>
                )}
              </div>
            </div>

            {/* Skill levels */}
            {tournament.skill_levels && tournament.skill_levels.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Skill Levels
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tournament.skill_levels.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Register buttons */}
            {withUrl.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                {withUrl.map((source) => (
                  <a
                    key={source.id}
                    href={source.registration_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                  >
                    {SOURCE_DISPLAY_NAMES[source.source_platform] ??
                      source.source_platform}{" "}
                    <span aria-hidden>{"\u2197"}</span>
                  </a>
                ))}
              </div>
            )}
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
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                About this tournament
              </h3>
              <p className="whitespace-pre-line leading-relaxed text-gray-600">
                {tournament.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
