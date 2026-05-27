"use client";

import type { TournamentMatch, TournamentEvent } from "@/lib/types";
import { winProbability, formatProbability } from "@/lib/predictions";
import { IntelSectionHeader } from "@/components/intel-section-header";
import { useState } from "react";

function MatchScores({ scores }: { scores: number[] }) {
  if (scores.length === 0) return null;
  return (
    <div className="flex gap-1">
      {scores.map((s, i) => (
        <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">
          {s}
        </span>
      ))}
    </div>
  );
}

function TeamRow({
  p1,
  p2,
  rating,
  seed,
  scores,
  isWinner,
  probability,
  side,
}: {
  p1: string | null;
  p2: string | null;
  rating: number | null;
  seed: number | null;
  scores: number[];
  isWinner: boolean;
  probability: number | null;
  side: "top" | "bottom";
}) {
  const names = [p1, p2].filter(Boolean).join(" / ") || "TBD";
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 ${
        side === "top" ? "rounded-t-lg" : "rounded-b-lg"
      } ${isWinner ? "bg-emerald-50" : ""}`}
    >
      {seed != null && (
        <span className="w-5 shrink-0 text-center text-[10px] font-bold text-gray-400">
          {seed}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <span className={`text-sm truncate block ${isWinner ? "font-bold text-emerald-900" : "font-medium text-gray-800"}`}>
          {names}
        </span>
      </div>
      {rating != null && (
        <span className="shrink-0 text-xs text-gray-400">
          {rating.toFixed(2)}
        </span>
      )}
      {probability != null && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          probability >= 0.5 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
        }`}>
          {formatProbability(probability)}
        </span>
      )}
      <MatchScores scores={scores} />
      {isWinner && (
        <span className="shrink-0 text-xs font-bold text-emerald-600">W</span>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: TournamentMatch }) {
  const hasRatings = match.team1_rating != null && match.team2_rating != null;
  const prob1 = hasRatings ? winProbability(match.team1_rating!, match.team2_rating!) : null;
  const prob2 = prob1 != null ? 1 - prob1 : null;

  const isCompleted = match.winner > 0;
  const isLive = match.match_start != null && !match.match_completed;

  return (
    <div className={`rounded-lg border ${isLive ? "border-emerald-300 ring-1 ring-emerald-100" : "border-gray-200"} bg-white`}>
      {/* Match header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          )}
          {isCompleted && (
            <span className="text-[10px] font-bold uppercase text-gray-400">Final</span>
          )}
          {!isLive && !isCompleted && (
            <span className="text-[10px] font-medium uppercase text-gray-400">
              {match.round_text || `R${match.round_number}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          {match.court_title && (
            <span>{match.court_title}</span>
          )}
          {match.planned_start && !isCompleted && (
            <span>
              {new Date(match.planned_start).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Teams */}
      <TeamRow
        p1={match.team1_player1_name}
        p2={match.team1_player2_name}
        rating={match.team1_rating}
        seed={match.team1_seed}
        scores={match.team1_scores}
        isWinner={match.winner === 1}
        probability={prob1}
        side="top"
      />
      <div className="border-t border-gray-100" />
      <TeamRow
        p1={match.team2_player1_name}
        p2={match.team2_player2_name}
        rating={match.team2_rating}
        seed={match.team2_seed}
        scores={match.team2_scores}
        isWinner={match.winner === 2}
        probability={prob2}
        side="bottom"
      />
    </div>
  );
}

function groupMatchesByEvent(
  matches: TournamentMatch[],
  events: TournamentEvent[],
): Map<string, { name: string; matches: TournamentMatch[] }> {
  const eventMap = new Map<string, string>();
  for (const e of events) {
    eventMap.set(e.id, e.name);
  }

  const groups = new Map<string, { name: string; matches: TournamentMatch[] }>();
  for (const match of matches) {
    const key = match.event_id ?? "unknown";
    const name = match.event_id ? (eventMap.get(match.event_id) ?? "Unknown Event") : "Unknown Event";
    if (!groups.has(key)) {
      groups.set(key, { name, matches: [] });
    }
    groups.get(key)!.matches.push(match);
  }
  return groups;
}

function groupByRound(matches: TournamentMatch[]): Map<number, TournamentMatch[]> {
  const rounds = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    if (!rounds.has(m.round_number)) rounds.set(m.round_number, []);
    rounds.get(m.round_number)!.push(m);
  }
  return rounds;
}

export function LiveBracket({
  matches,
  events,
}: {
  matches: TournamentMatch[];
  events: TournamentEvent[];
}) {
  if (matches.length === 0) return null;

  const grouped = groupMatchesByEvent(matches, events);
  const eventKeys = Array.from(grouped.keys());
  const [selectedEvent, setSelectedEvent] = useState(eventKeys[0]);

  const liveCount = matches.filter((m) => m.match_start != null && !m.match_completed).length;
  const completedCount = matches.filter((m) => m.winner > 0).length;
  const badgeText = liveCount > 0
    ? `${liveCount} live`
    : completedCount > 0
      ? `${completedCount}/${matches.length} completed`
      : `${matches.length} matches`;

  const current = grouped.get(selectedEvent);
  const rounds = current ? groupByRound(current.matches) : new Map();

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      <IntelSectionHeader title="Live Bracket" badge={badgeText} />

      {/* Event selector */}
      {eventKeys.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 bg-white px-4 py-2">
          {eventKeys.map((key) => {
            const group = grouped.get(key)!;
            const isSelected = key === selectedEvent;
            const eventLive = group.matches.filter((m) => m.match_start && !m.match_completed).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedEvent(key)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  isSelected
                    ? "bg-emerald-700 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {group.name}
                {eventLive > 0 && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Rounds */}
      <div className="bg-white p-4 space-y-6">
        {Array.from(rounds.entries()).map(([roundNum, roundMatches]: [number, TournamentMatch[]]) => {
          const roundLabel = roundMatches[0]?.round_text || `Round ${roundNum}`;
          return (
            <div key={roundNum}>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                {roundLabel}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {roundMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
