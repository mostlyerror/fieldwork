import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getPlayer,
  getPlayerMatches,
  getPlayerUpcomingTournaments,
  computePlayerRecord,
  computeFrequentPartners,
} from "@/lib/queries";
import { IntelSectionHeader } from "@/components/intel-section-header";
import { BackButton } from "@/components/back-button";
import { ServerHeader } from "@/components/server-header";
import { getDefaultCity } from "@/lib/cities";
import type { Match } from "@/lib/types";

export const revalidate = 600;

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) return { title: "Player Not Found" };

  const ratingStr = player.dupr_doubles != null ? ` — ${player.dupr_doubles.toFixed(2)}` : "";
  return {
    title: `${player.name}${ratingStr} — PickleRadar`,
    description: `View ${player.name}'s pickleball match history, W-L record, and rating on PickleRadar.`,
  };
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function winRate(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "0%";
  return `${Math.round((wins / total) * 100)}%`;
}

function getMatchOpponents(match: Match, playerId: string): {
  partner: string | null;
  partnerId: string | null;
  opp1: string;
  opp1Id: string | null;
  opp2: string | null;
  opp2Id: string | null;
} {
  const onTeam1 =
    match.team1_player1_id === playerId ||
    match.team1_player2_id === playerId;

  if (onTeam1) {
    const isP1 = match.team1_player1_id === playerId;
    return {
      partner: (isP1 ? match.team1_player2_name : match.team1_player1_name) ?? null,
      partnerId: (isP1 ? match.team1_player2_id : match.team1_player1_id) ?? null,
      opp1: match.team2_player1_name,
      opp1Id: match.team2_player1_id ?? null,
      opp2: match.team2_player2_name ?? null,
      opp2Id: match.team2_player2_id ?? null,
    };
  } else {
    const isP1 = match.team2_player1_id === playerId;
    return {
      partner: (isP1 ? match.team2_player2_name : match.team2_player1_name) ?? null,
      partnerId: (isP1 ? match.team2_player2_id : match.team2_player1_id) ?? null,
      opp1: match.team1_player1_name,
      opp1Id: match.team1_player1_id ?? null,
      opp2: match.team1_player2_name ?? null,
      opp2Id: match.team1_player2_id ?? null,
    };
  }
}

function getMatchWon(match: Match, playerId: string): boolean {
  const onTeam1 =
    match.team1_player1_id === playerId ||
    match.team1_player2_id === playerId;
  return onTeam1 ? match.team1_won : !match.team1_won;
}

function GameScores({ match }: { match: Match }) {
  const games: { t1: number | null; t2: number | null }[] = [
    { t1: match.game1_team1, t2: match.game1_team2 },
    { t1: match.game2_team1, t2: match.game2_team2 },
    { t1: match.game3_team1, t2: match.game3_team2 },
  ].filter((g) => g.t1 != null && g.t2 != null);

  if (games.length === 0) return null;

  return (
    <div className="flex gap-1.5 text-xs text-gray-500 font-mono">
      {games.map((g, i) => (
        <span key={i} className="whitespace-nowrap">
          {g.t1}-{g.t2}
        </span>
      ))}
    </div>
  );
}

export default async function PlayerPage({ params }: PageProps) {
  const { id } = await params;
  const [player, matches, upcoming] = await Promise.all([
    getPlayer(id),
    getPlayerMatches(id, 20),
    getPlayerUpcomingTournaments(id),
  ]);

  if (!player) notFound();

  const city = getDefaultCity();
  const records = computePlayerRecord(matches, id);
  const partners = computeFrequentPartners(matches, id);

  const totalWins = records.reduce((s, r) => s + r.wins, 0);
  const totalLosses = records.reduce((s, r) => s + r.losses, 0);
  const hasMatches = matches.length > 0;
  const recentMatches = matches.slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      <ServerHeader city={city} />

      <main className="mx-auto max-w-3xl px-5 py-8">
        {/* Back link — uses browser history so it returns to the referring page
             (e.g. a specific tournament) instead of always going to the list */}
        <BackButton fallbackHref={`/${city.slug}`} label="Back" />

        {/* Player header card */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">
                {player.name}
              </h1>
              {player.location && (
                <p className="mt-1 text-sm text-gray-500">{player.location}</p>
              )}
              {player.dupr_last_checked && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Updated{" "}
                  {new Date(player.dupr_last_checked).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-start gap-4">
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Doubles
                </p>
                {player.dupr_doubles != null ? (
                  <>
                    <p className="text-3xl font-extrabold text-emerald-600 leading-none mt-0.5">
                      {player.dupr_doubles.toFixed(2)}
                    </p>
                    {player.dupr_verified && (
                      <span className="mt-1.5 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                        Verified
                      </span>
                    )}
                  </>
                ) : (
                  <p className="text-2xl font-extrabold text-gray-200 leading-none mt-0.5">--</p>
                )}
              </div>
              <div className={`text-right border-l border-gray-100 pl-4`}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Singles
                </p>
                {player.dupr_singles != null ? (
                  <p className="text-3xl font-extrabold text-emerald-600 leading-none mt-0.5">
                    {player.dupr_singles.toFixed(2)}
                  </p>
                ) : (
                  <p className="text-2xl font-extrabold text-gray-200 leading-none mt-0.5">--</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Record breakdown */}
        {hasMatches && (
          <section className="mt-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Overall */}
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Overall
                </p>
                <p className="mt-1 text-xl font-extrabold text-gray-900">
                  {totalWins}W–{totalLosses}L
                </p>
                <p className="text-xs text-gray-500">
                  {winRate(totalWins, totalLosses)} win rate
                </p>
              </div>

              {/* Per format */}
              {records.map((r) => (
                <div
                  key={r.format}
                  className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {r.format}
                  </p>
                  <p className="mt-1 text-xl font-extrabold text-gray-900">
                    {r.wins}W–{r.losses}L
                  </p>
                  <p className="text-xs text-gray-500">
                    {winRate(r.wins, r.losses)} win rate
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Frequent Partners */}
        {partners.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-xl shadow-sm ring-1 ring-gray-100">
            <IntelSectionHeader title="Frequent Partners" />
            <div className="divide-y divide-gray-50 bg-white">
              {partners.map((p) => (
                <div
                  key={p.playerId ?? p.name}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700">
                    {initials(p.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    {p.playerId ? (
                      <Link
                        href={`/players/${p.playerId}`}
                        className="font-semibold text-gray-900 hover:text-emerald-700 text-sm"
                      >
                        {p.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-gray-900 text-sm">
                        {p.name}
                      </span>
                    )}
                    <p className="text-xs text-gray-400">
                      {p.matchCount} match{p.matchCount !== 1 ? "es" : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs font-medium text-gray-600">
                      {p.wins}W–{p.losses}L
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Matches */}
        {recentMatches.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-xl shadow-sm ring-1 ring-gray-100">
            <IntelSectionHeader
              title="Recent Matches"
              badge={`${matches.length} match${matches.length !== 1 ? "es" : ""}`}
            />
            <div className="divide-y divide-gray-50 bg-white">
              {recentMatches.map((match) => {
                const won = getMatchWon(match, id);
                const { partner, partnerId, opp1, opp1Id, opp2, opp2Id } = getMatchOpponents(match, id);
                return (
                  <div key={match.id} className="flex items-start gap-3 px-4 py-3">
                    {/* W/L badge */}
                    <div
                      className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${
                        won
                          ? "bg-gray-100 text-gray-700"
                          : "bg-gray-50 text-gray-400"
                      }`}
                    >
                      {won ? "W" : "L"}
                    </div>

                    {/* Match details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400">
                          {formatDate(match.event_date)}
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 bg-gray-50 rounded px-1.5 py-0.5">
                          {match.event_format}
                        </span>
                        {match.league && (
                          <span className="text-xs text-gray-400 truncate">
                            {match.league}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-gray-700 truncate">
                        {partner && (
                          <span>
                            <span className="text-gray-400">w/ </span>
                            {partnerId ? (
                              <Link href={`/players/${partnerId}`} className="hover:text-emerald-700 hover:underline">{partner}</Link>
                            ) : partner}
                            <span className="text-gray-400"> vs </span>
                          </span>
                        )}
                        {!partner && (
                          <span className="text-gray-400">vs </span>
                        )}
                        {opp1Id ? (
                          <Link href={`/players/${opp1Id}`} className="hover:text-emerald-700 hover:underline">{opp1}</Link>
                        ) : opp1}
                        {opp2 && (
                          <>
                            {" + "}
                            {opp2Id ? (
                              <Link href={`/players/${opp2Id}`} className="hover:text-emerald-700 hover:underline">{opp2}</Link>
                            ) : opp2}
                          </>
                        )}
                      </p>
                    </div>

                    {/* Scores */}
                    <div className="shrink-0 text-right">
                      <GameScores match={match} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Upcoming Tournaments */}
        {upcoming.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-xl shadow-sm ring-1 ring-gray-100">
            <IntelSectionHeader title="Upcoming Tournaments" />
            <div className="divide-y divide-gray-50 bg-white">
              {upcoming.map((t, i) => (
                <Link
                  key={`${t.tournamentId}-${t.eventName}-${i}`}
                  href={`/${city.slug}/tournaments/${t.tournamentId}`}
                  className="flex items-start justify-between gap-4 px-4 py-3 transition hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {t.tournamentName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{t.eventName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">{formatDate(t.dateStart)}</p>
                    {t.listedDupr != null && (
                      <p className="text-xs font-medium text-emerald-600 mt-0.5">
                        Listed {t.listedDupr.toFixed(2)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!hasMatches && upcoming.length === 0 && (
          <div className="mt-8 rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-gray-400">No match history or upcoming tournaments available yet</p>
          </div>
        )}
      </main>
    </div>
  );
}
