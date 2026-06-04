import Link from "next/link";
import type { Tournament, TournamentEvent } from "@/lib/types";
import { scoreAndRankTournaments } from "@/lib/recommendations";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { getFieldStrengthLevel, type FieldStrengthLevel } from "./field-strength-badge";

/** Quiet field-intel tone keyed to the field-strength level. Mirrors the card. */
const FS_TONE: Record<FieldStrengthLevel, { label: string; tone: "good" | "alert" }> = {
  friendly: { label: "Friendly field", tone: "good" },
  competitive: { label: "Competitive", tone: "good" },
  stacked: { label: "Stacked", tone: "alert" },
  sandbagger: { label: "Over-cap field", tone: "alert" },
};

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
        <h2 className="t-h2 text-gray-900">
          Tournaments For You
        </h2>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 t-caption font-semibold text-emerald-700">
          Personalized
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recommendations.map(({ tournament, reason }) => {
          const fsLevel = getFieldStrengthLevel(
            tournament.avg_field_strength,
            tournament.max_sandbagger_pct,
          );
          const fs = fsLevel ? FS_TONE[fsLevel] : null;
          return (
            <Link
              key={tournament.id}
              href={`/${citySlug}/tournaments/${tournament.id}`}
              className="group flex h-full flex-col rounded-2xl border border-gray-200/70 bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="t-label mb-1.5 flex items-center gap-1.5 text-emerald-700">
                <span className="truncate">
                  {formatDateRange(tournament.date_start, tournament.date_end)}
                </span>
              </div>

              <h3 className="t-h2 text-gray-900 group-hover:text-emerald-700">
                {tournament.name}
              </h3>

              <p className="mt-1 flex items-center gap-1.5 t-small text-gray-500">
                <span aria-hidden="true">{"\u{1F4CD}"}</span>
                <span className="truncate">{tournament.location_name}</span>
              </p>

              {fs && (
                <div
                  className={`mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 t-small font-medium ${
                    fs.tone === "alert" ? "text-red-700/80" : "text-gray-500"
                  }`}
                >
                  <span
                    className={`h-[7px] w-[7px] shrink-0 rounded-full ring-[3px] ${
                      fs.tone === "alert" ? "bg-red-500 ring-red-100" : "bg-emerald-500 ring-emerald-100"
                    }`}
                  />
                  <span className={`font-bold ${fs.tone === "alert" ? "text-red-700" : "text-emerald-800"}`}>
                    {fs.label}
                  </span>
                </div>
              )}

              <p className="mt-2 t-caption text-emerald-700">{reason}</p>

              {tournament.entry_fee != null && (
                <p className="mt-auto pt-2 t-body font-bold text-emerald-800">
                  {formatCurrency(tournament.entry_fee)}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
