import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getPlayer,
  getPlayerMatches,
  getPlayerUpcomingTournaments,
  getPlayerRatingHistory,
  computePlayerRecord,
  computeFrequentPartners,
} from "@/lib/queries";
import { IntelSectionHeader } from "@/components/intel-section-header";
import { PlayerRatingChart } from "@/components/player-rating-chart";
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
    <div className="flex gap-1.5 t-caption text-gray-500 font-mono">
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
  const [player, matches, upcoming, ratingHistory] = await Promise.all([
    getPlayer(id),
    getPlayerMatches(id, 20),
    getPlayerUpcomingTournaments(id),
    getPlayerRatingHistory(id),
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

      <main className="mx-auto max-w-3xl px-3 sm:px-5 py-8">
        {/* Back link — uses browser history so it returns to the referring page
             (e.g. a specific tournament) instead of always going to the list */}
        <BackButton
          fallbackHref={`/${city.slug}`}
          label="Back"
          className="mb-6 inline-flex min-h-[44px] items-center py-2 t-body text-gray-400 hover:text-emerald-700"
        />

        {/* Player header card */}
        <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-card sm:rounded-3xl">
          <div>
            <h1 className="t-h1 text-gray-900">
              {player.name}
            </h1>
            {player.location && (
              <p className="mt-1 t-body text-gray-500">{player.location}</p>
            )}
            {player.dupr_last_checked && (
              <p className="mt-1 t-caption text-gray-400">
                Updated{" "}
                {new Date(player.dupr_last_checked).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>

          {/* Rating fact row — uniform, hairline-divided */}
          <div className="mt-5 grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100 pt-4">
            <div className="min-w-0 px-2.5 first:pl-0 last:pr-0">
              <div className="t-label text-gray-400">Doubles</div>
              {player.dupr_doubles != null ? (
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="t-h3 tabular-nums text-emerald-800">
                    {player.dupr_doubles.toFixed(2)}
                  </span>
                  {player.dupr_verified && (
                    <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 t-label text-emerald-700">
                      Verified
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-1 t-h3 tabular-nums text-gray-300">--</div>
              )}
            </div>
            <div className="min-w-0 px-2.5 first:pl-0 last:pr-0">
              <div className="t-label text-gray-400">Singles</div>
              {player.dupr_singles != null ? (
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="t-h3 tabular-nums text-emerald-800">
                    {player.dupr_singles.toFixed(2)}
                  </span>
                  {player.dupr_verified && (
                    <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 t-label text-emerald-700">
                      Verified
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-1 t-h3 tabular-nums text-gray-300">--</div>
              )}
            </div>
          </div>
        </div>

        {/* Doubles rating trend over time (from DUPR match history) */}
        {ratingHistory.length >= 2 && (
          <section className="mt-6">
            <PlayerRatingChart points={ratingHistory} />
          </section>
        )}

        {/* Record breakdown — editorial fact row, hairline-divided */}
        {hasMatches && (
          <section className="mt-6">
            <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-card sm:rounded-3xl sm:p-6">
              <div className={`grid divide-x divide-gray-100 ${records.length >= 3 ? "grid-cols-4" : records.length === 2 ? "grid-cols-3" : "grid-cols-2"}`}>
                {/* Overall */}
                <div className="min-w-0 px-2.5 first:pl-0 last:pr-0">
                  <div className="t-label text-gray-400">Overall</div>
                  <div className="mt-1 t-h3 tabular-nums text-gray-900">
                    {totalWins}W–{totalLosses}L
                  </div>
                  <div className="mt-0.5 t-caption text-gray-500">
                    {winRate(totalWins, totalLosses)} win rate
                  </div>
                </div>

                {/* Per format */}
                {records.map((r) => (
                  <div key={r.format} className="min-w-0 px-2.5 first:pl-0 last:pr-0">
                    <div className="t-label text-gray-400">{r.format}</div>
                    <div className="mt-1 t-h3 tabular-nums text-gray-900">
                      {r.wins}W–{r.losses}L
                    </div>
                    <div className="mt-0.5 t-caption text-gray-500">
                      {winRate(r.wins, r.losses)} win rate
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Frequent Partners */}
        {partners.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200/70 shadow-card sm:rounded-3xl">
            <IntelSectionHeader title="Frequent Partners" />
            <div className="divide-y divide-gray-50 bg-white">
              {partners.map((p) => (
                <div
                  key={p.playerId ?? p.name}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 t-caption font-bold text-emerald-700">
                    {initials(p.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    {p.playerId ? (
                      <Link
                        href={`/players/${p.playerId}`}
                        className="block truncate t-body font-semibold text-gray-900 hover:text-emerald-700"
                      >
                        {p.name}
                      </Link>
                    ) : (
                      <span className="block truncate t-body font-semibold text-gray-900">
                        {p.name}
                      </span>
                    )}
                    <p className="t-caption text-gray-400">
                      {p.matchCount} match{p.matchCount !== 1 ? "es" : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="t-caption text-gray-600">
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
          <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200/70 shadow-card sm:rounded-3xl">
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
                      className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 t-caption font-bold ${
                        won
                          ? "bg-gray-100 text-gray-700"
                          : "bg-gray-50 text-gray-400"
                      }`}
                    >
                      {won ? "W" : "L"}
                    </div>

                    {/* Match details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                        <div className="flex items-center gap-2">
                          <span className="t-caption text-gray-400">
                            {formatDate(match.event_date)}
                          </span>
                          <span className="t-label font-medium text-gray-400 bg-gray-50 rounded px-1.5 py-0.5">
                            {match.event_format}
                          </span>
                        </div>
                        {match.league && (
                          <span className="t-caption text-gray-400 truncate">
                            {match.league}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-col gap-0.5 t-body text-gray-700 sm:flex-row sm:flex-wrap sm:gap-x-3 sm:gap-y-0.5">
                        {partner && (
                          <p className="truncate">
                            <span className="text-gray-400">w/ </span>
                            {partnerId ? (
                              <Link href={`/players/${partnerId}`} className="hover:text-emerald-700 hover:underline">{partner}</Link>
                            ) : partner}
                          </p>
                        )}
                        <p className="truncate">
                          <span className="text-gray-400">vs </span>
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
          <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200/70 shadow-card sm:rounded-3xl">
            <IntelSectionHeader title="Upcoming Tournaments" />
            <div className="divide-y divide-gray-50 bg-white">
              {upcoming.map((t, i) => (
                <Link
                  key={`${t.tournamentId}-${t.eventName}-${i}`}
                  href={`/${city.slug}/tournaments/${t.tournamentId}`}
                  className="flex items-start justify-between gap-4 px-4 py-3 transition hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="t-body font-semibold text-gray-900 truncate">
                      {t.tournamentName}
                    </p>
                    <p className="t-caption text-gray-500 truncate">{t.eventName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="t-caption text-gray-400">{formatDate(t.dateStart)}</p>
                    {t.listedDupr != null && (
                      <p className="t-caption text-emerald-600 mt-0.5">
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
          <div className="mt-8 rounded-2xl border border-gray-200/70 bg-white p-8 text-center shadow-card sm:rounded-3xl">
            <p className="text-gray-400">No match history or upcoming tournaments available yet</p>
          </div>
        )}
      </main>
    </div>
  );
}
