"use client";

import { useState } from "react";
import Link from "next/link";
import type { Match } from "@/lib/types";
import type { RecentMatchesProps } from "@/components/player/types";
import { IntelSectionHeader } from "@/components/intel-section-header";

const DEFAULT_VISIBLE = 5;

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMatchOpponents(
  match: Match,
  playerId: string,
): {
  partner: string | null;
  partnerId: string | null;
  opp1: string;
  opp1Id: string | null;
  opp2: string | null;
  opp2Id: string | null;
} {
  const onTeam1 =
    match.team1_player1_id === playerId || match.team1_player2_id === playerId;

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
  }
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

function getMatchWon(match: Match, playerId: string): boolean {
  const onTeam1 =
    match.team1_player1_id === playerId || match.team1_player2_id === playerId;
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
    <div className="flex gap-1.5 t-caption font-mono tabular-nums text-gray-500">
      {games.map((g, i) => (
        <span key={i} className="whitespace-nowrap">
          {g.t1}-{g.t2}
        </span>
      ))}
    </div>
  );
}

function MatchRow({ match, playerId }: { match: Match; playerId: string }) {
  const won = getMatchWon(match, playerId);
  const { partner, partnerId, opp1, opp1Id, opp2, opp2Id } = getMatchOpponents(
    match,
    playerId,
  );

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {/* W/L badge */}
      <div
        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 t-caption font-bold ${
          won ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-400"
        }`}
      >
        {won ? "W" : "L"}
      </div>

      {/* Match details */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <div className="flex items-center gap-2">
            <span className="t-caption tabular-nums text-gray-400">
              {formatDate(match.event_date)}
            </span>
            <span className="t-label rounded bg-gray-50 px-1.5 py-0.5 font-medium text-gray-400">
              {match.event_format}
            </span>
          </div>
          {match.league && (
            <span className="t-caption truncate text-gray-400">
              {match.league}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-col gap-0.5 t-body text-gray-700 sm:flex-row sm:flex-wrap sm:gap-x-3 sm:gap-y-0.5">
          {partner && (
            <p className="truncate">
              <span className="text-gray-400">w/ </span>
              {partnerId ? (
                <Link
                  href={`/players/${partnerId}`}
                  className="hover:text-emerald-700 hover:underline"
                >
                  {partner}
                </Link>
              ) : (
                partner
              )}
            </p>
          )}
          <p className="truncate">
            <span className="text-gray-400">vs </span>
            {opp1Id ? (
              <Link
                href={`/players/${opp1Id}`}
                className="hover:text-emerald-700 hover:underline"
              >
                {opp1}
              </Link>
            ) : (
              opp1
            )}
            {opp2 && (
              <>
                {" + "}
                {opp2Id ? (
                  <Link
                    href={`/players/${opp2Id}`}
                    className="hover:text-emerald-700 hover:underline"
                  >
                    {opp2}
                  </Link>
                ) : (
                  opp2
                )}
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
}

export function RecentMatches({
  matches,
  playerId,
  totalCount,
}: RecentMatchesProps) {
  const [expanded, setExpanded] = useState(false);

  if (matches.length === 0) return null;

  const hasMore = matches.length > DEFAULT_VISIBLE;
  const visible = expanded ? matches : matches.slice(0, DEFAULT_VISIBLE);

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/70 shadow-card sm:rounded-3xl">
      <IntelSectionHeader
        title="Recent Matches"
        badge={`${totalCount} match${totalCount !== 1 ? "es" : ""}`}
      />
      <div className="divide-y divide-gray-100 bg-white">
        {visible.map((match) => (
          <MatchRow key={match.id} match={match} playerId={playerId} />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-h-[44px] w-full items-center justify-center gap-1.5 border-t border-gray-100 bg-white px-4 py-3 t-caption font-semibold text-emerald-700 transition hover:bg-emerald-50"
        >
          {expanded ? "Show less" : `Show all (${matches.length})`}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`h-3.5 w-3.5 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
    </section>
  );
}
