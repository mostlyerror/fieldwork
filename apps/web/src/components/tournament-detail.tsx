import type { Tournament, TournamentSource } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { SkillBadge } from "./skill-badge";
import { StatusBadge } from "./status-badge";
import { SourceLinks } from "./source-links";

const FORMAT_LABELS: Record<string, string> = {
  round_robin: "Round Robin",
  single_elim: "Single Elimination",
  double_elim: "Double Elimination",
  mixed: "Mixed",
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
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">{tournament.name}</h1>
          <StatusBadge status={tournament.registration_status} />
        </div>
        <p className="text-lg text-gray-600">
          {formatDateRange(tournament.date_start, tournament.date_end)}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Location */}
          <section>
            <h3 className="mb-1 text-sm font-semibold text-gray-500">
              Location
            </h3>
            <p className="font-medium">{tournament.location_name}</p>
            {tournament.location_address && (
              <p className="text-sm text-gray-500">
                {tournament.location_address}
              </p>
            )}
          </section>

          {/* Details grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {tournament.format && (
              <section>
                <h3 className="mb-1 text-sm font-semibold text-gray-500">
                  Format
                </h3>
                <p className="font-medium">
                  {FORMAT_LABELS[tournament.format] ?? tournament.format}
                </p>
              </section>
            )}
            {tournament.entry_fee != null && (
              <section>
                <h3 className="mb-1 text-sm font-semibold text-gray-500">
                  Entry Fee
                </h3>
                <p className="font-medium">
                  {formatCurrency(tournament.entry_fee)}
                </p>
              </section>
            )}
          </div>

          {/* Skill levels */}
          {tournament.skill_levels && tournament.skill_levels.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-500">
                Skill Levels
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {tournament.skill_levels.map((level) => (
                  <SkillBadge key={level} level={level} />
                ))}
              </div>
            </section>
          )}

          {/* Description */}
          {tournament.description && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-500">
                Description
              </h3>
              <p className="whitespace-pre-line text-gray-700">
                {tournament.description}
              </p>
            </section>
          )}

          {/* Registration links */}
          <SourceLinks sources={sources} />
        </div>

        {/* Sidebar: mini map */}
        <div className="space-y-4">
          {miniMap && (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              {miniMap}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
