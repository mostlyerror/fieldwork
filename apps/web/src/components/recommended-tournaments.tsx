import Link from "next/link";
import type { Tournament, TournamentEvent } from "@/lib/types";
import { scoreAndRankTournaments } from "@/lib/recommendations";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { FieldStrengthBadge } from "./field-strength-badge";

interface UserProfile {
  dupr_rating_doubles: number | null;
  dupr_rating_singles: number | null;
  location_latitude: number | null;
  location_longitude: number | null;
}

export function RecommendedTournaments({
  tournaments,
  user,
  events,
  citySlug,
}: {
  tournaments: Tournament[];
  user: UserProfile;
  events: Map<string, TournamentEvent[]>;
  citySlug: string;
}) {
  const recommendations = scoreAndRankTournaments(tournaments, user, events);

  if (recommendations.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="t-h2 font-bold text-gray-800">
          Tournaments For You
        </h2>
        <span className="rounded-full bg-green-50 px-2 py-0.5 t-caption font-semibold text-green-600">
          Personalized
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recommendations.map(({ tournament, reason }) => (
          <Link
            key={tournament.id}
            href={`/${citySlug}/tournaments/${tournament.id}`}
            className="group block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-green-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-green-300"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 t-caption font-semibold text-amber-700">
                {formatDateRange(tournament.date_start, tournament.date_end)}
              </span>
              <FieldStrengthBadge
                avgFieldStrength={tournament.avg_field_strength}
                maxSandbaggerPct={tournament.max_sandbagger_pct}
              />
            </div>

            <h3 className="mb-1 font-bold text-gray-900 group-hover:text-green-700">
              {tournament.name}
            </h3>

            <p className="mb-2 flex items-center gap-1.5 t-body text-gray-500">
              <span>{"\u{1F4CD}"}</span> {tournament.location_name}
            </p>

            <p className="t-caption text-green-600">{reason}</p>

            {tournament.entry_fee != null && (
              <p className="mt-1 t-body font-bold text-green-600">
                {formatCurrency(tournament.entry_fee)}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
