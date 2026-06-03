"use client";

import type { TournamentMatch, TournamentEvent } from "@/lib/types";
import { winProbability, formatProbability } from "@/lib/predictions";
import { IntelSectionHeader } from "@/components/intel-section-header";
import { cleanEventName } from "@/lib/event-name";
import { useState } from "react";

// --- Pool standings ---

interface PoolTeam {
  name: string;
  rating: number | null;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

function buildPoolStandings(matches: TournamentMatch[]): PoolTeam[] {
  const teams = new Map<string, PoolTeam>();

  function getOrCreate(names: string[], rating: number | null): PoolTeam {
    const key = names.filter(Boolean).join(" / ");
    if (!teams.has(key)) {
      teams.set(key, { name: key, rating, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
    }
    return teams.get(key)!;
  }

  for (const m of matches) {
    const t1 = getOrCreate(
      [m.team1_player1_name, m.team1_player2_name].filter(Boolean) as string[],
      m.team1_rating,
    );
    const t2 = getOrCreate(
      [m.team2_player1_name, m.team2_player2_name].filter(Boolean) as string[],
      m.team2_rating,
    );

    const pf1 = m.team1_scores.reduce((a, b) => a + b, 0);
    const pf2 = m.team2_scores.reduce((a, b) => a + b, 0);
    t1.pointsFor += pf1;
    t1.pointsAgainst += pf2;
    t2.pointsFor += pf2;
    t2.pointsAgainst += pf1;

    if (m.winner === 1) { t1.wins++; t2.losses++; }
    else if (m.winner === 2) { t2.wins++; t1.losses++; }
  }

  return Array.from(teams.values()).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
  });
}

function PoolTable({ label, matches }: { label: string; matches: TournamentMatch[] }) {
  const standings = buildPoolStandings(matches);
  const allDone = matches.every((m) => m.winner > 0);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        <span className="t-label tracking-widest text-gray-400">
          {label}
        </span>
        {allDone && (
          <span className="t-label font-medium text-gray-400">Complete</span>
        )}
      </div>
      <table className="w-full t-body">
        <thead>
          <tr className="border-b border-gray-100 text-left t-label font-semibold tracking-wider text-gray-400">
            <th className="px-3 py-1 w-5 hidden sm:table-cell">#</th>
            <th className="px-3 py-1">Team</th>
            <th className="px-3 py-1 text-center">W-L</th>
            <th className="px-3 py-1 text-right hidden sm:table-cell">+/-</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {standings.map((team, i) => (
            <tr key={team.name} className={i === 0 ? "bg-emerald-50/50" : ""}>
              <td className="px-3 py-1.5 t-caption font-bold text-gray-400 hidden sm:table-cell">{i + 1}</td>
              <td className="px-3 py-1.5">
                <span className="t-body text-gray-800">{team.name}</span>
                {team.rating != null && (
                  <span className="ml-1.5 t-caption text-gray-400">{team.rating.toFixed(2)}</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-center t-body font-bold text-gray-700">
                {team.wins}-{team.losses}
              </td>
              <td className="px-3 py-1.5 text-right t-caption hidden sm:table-cell">
                <span className={team.pointsFor - team.pointsAgainst >= 0 ? "text-emerald-600" : "text-red-500"}>
                  {team.pointsFor - team.pointsAgainst >= 0 ? "+" : ""}{team.pointsFor - team.pointsAgainst}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Bracket match (compact) ---

function BracketMatch({ match }: { match: TournamentMatch }) {
  const hasRatings = match.team1_rating != null && match.team2_rating != null;
  const prob1 = hasRatings ? winProbability(match.team1_rating!, match.team2_rating!) : null;

  const isCompleted = match.winner > 0;
  const isLive = match.match_start != null && !match.match_completed;

  function formatScores(scores: number[]): string {
    return scores.filter((_, i) => (match.team1_scores[i] ?? 0) > 0 || (match.team2_scores[i] ?? 0) > 0)
      .join("-");
  }

  function TeamLine({ names, seed, scores, isWinner, prob }: {
    names: string; seed: number | null;
    scores: number[]; isWinner: boolean; prob: number | null;
  }) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 ${isWinner ? "bg-emerald-50" : ""}`}>
        {seed != null && (
          <span className="w-4 shrink-0 t-caption font-bold text-gray-300">{seed}</span>
        )}
        <span className={`flex-1 truncate t-body ${isWinner ? "font-bold text-gray-900" : "text-gray-600"}`}>
          {names || "TBD"}
        </span>
        {prob != null && !isCompleted && (
          <span className={`shrink-0 t-caption font-semibold ${prob >= 0.5 ? "text-emerald-600" : "text-gray-400"}`}>
            {formatProbability(prob)}
          </span>
        )}
        <span className="shrink-0 w-14 text-right t-caption font-mono text-gray-500">
          {formatScores(scores) || ""}
        </span>
      </div>
    );
  }

  const t1Names = [match.team1_player1_name, match.team1_player2_name].filter(Boolean).join(" / ");
  const t2Names = [match.team2_player1_name, match.team2_player2_name].filter(Boolean).join(" / ");
  const isBye = match.id.startsWith("bye-");

  if (isBye) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50">
          {match.team1_seed != null && (
            <span className="w-4 shrink-0 t-caption font-bold text-gray-300">{match.team1_seed}</span>
          )}
          <span className="flex-1 truncate t-body font-bold text-gray-900">{t1Names}</span>
        </div>
        <div className="border-t border-dashed border-gray-200" />
        <div className="px-3 py-1.5">
          <span className="t-body italic text-gray-400">BYE</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border overflow-hidden ${isLive ? "border-emerald-300 ring-1 ring-emerald-100" : "border-gray-200"}`}>
      <TeamLine names={t1Names} seed={match.team1_seed} scores={match.team1_scores}
        isWinner={match.winner === 1} prob={prob1} />
      <div className="border-t border-gray-100" />
      <TeamLine names={t2Names} seed={match.team2_seed} scores={match.team2_scores}
        isWinner={match.winner === 2} prob={prob1 != null ? 1 - prob1 : null} />
    </div>
  );
}

// --- Main layout ---

function EventBracketView({ matches }: { matches: TournamentMatch[] }) {
  const rrMatches = matches.filter((m) => m.bracket_type === "RR");
  const bracketMatches = matches.filter((m) => m.bracket_type !== "RR");

  const pools = new Map<string, TournamentMatch[]>();
  for (const m of rrMatches) {
    const pid = m.pool_id ?? "default";
    if (!pools.has(pid)) pools.set(pid, []);
    pools.get(pid)!.push(m);
  }

  const consolationTypes = new Set(["B"]);
  const mainBracket = bracketMatches.filter((m) => !consolationTypes.has(m.bracket_type ?? ""));
  const consolation = bracketMatches.filter((m) => consolationTypes.has(m.bracket_type ?? ""));

  const bracketRounds = new Map<string, TournamentMatch[]>();
  for (const m of mainBracket) {
    const label = m.round_text || `Round ${m.round_number}`;
    if (!bracketRounds.has(label)) bracketRounds.set(label, []);
    bracketRounds.get(label)!.push(m);
  }

  // Detect byes: teams in round 2 that didn't play in round 1
  const roundEntries = Array.from(bracketRounds.entries());
  if (roundEntries.length >= 2) {
    const [firstLabel, firstRoundMatches] = roundEntries[0];
    const [, secondRoundMatches] = roundEntries[1];

    const firstRoundTeams = new Set<string>();
    for (const m of firstRoundMatches) {
      const t1 = [m.team1_player1_name, m.team1_player2_name].filter(Boolean).join(" / ");
      const t2 = [m.team2_player1_name, m.team2_player2_name].filter(Boolean).join(" / ");
      firstRoundTeams.add(t1);
      firstRoundTeams.add(t2);
    }

    for (const m of secondRoundMatches) {
      for (const side of [1, 2] as const) {
        const names = [
          side === 1 ? m.team1_player1_name : m.team2_player1_name,
          side === 1 ? m.team1_player2_name : m.team2_player2_name,
        ].filter(Boolean).join(" / ");

        if (names && !firstRoundTeams.has(names)) {
          const byeMatch: TournamentMatch = {
            id: `bye-${names}`,
            match_uuid: `bye-${names}`,
            tournament_id: m.tournament_id,
            event_id: m.event_id,
            team1_player1_name: side === 1 ? m.team1_player1_name : m.team2_player1_name,
            team1_player2_name: side === 1 ? m.team1_player2_name : m.team2_player2_name,
            team2_player1_name: null,
            team2_player2_name: null,
            team1_rating: side === 1 ? m.team1_rating : m.team2_rating,
            team2_rating: null,
            team1_seed: side === 1 ? m.team1_seed : m.team2_seed,
            team2_seed: null,
            team1_scores: [],
            team2_scores: [],
            winner: 1,
            match_status: 3,
            round_number: firstRoundMatches[0].round_number,
            match_number: 0,
            round_text: firstRoundMatches[0].round_text,
            bracket_type: firstRoundMatches[0].bracket_type,
            pool_id: null,
            court_title: null,
            planned_start: null,
            match_start: null,
            match_completed: null,
          };
          bracketRounds.get(firstLabel)!.push(byeMatch);
        }
      }
    }
  }

  return (
    <div className="space-y-5 p-4 bg-white">
      {pools.size > 0 && (
        <div>
          <h4 className="mb-2 t-caption font-bold uppercase tracking-widest text-gray-400">
            Pools
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from(pools.entries()).map(([pid, poolMatches], i) => (
              <PoolTable key={pid} label={`Pool ${String.fromCharCode(65 + i)}`} matches={poolMatches} />
            ))}
          </div>
        </div>
      )}

      {bracketRounds.size > 0 && (
        <div>
          <h4 className="mb-2 t-caption font-bold uppercase tracking-widest text-gray-400">
            Medal Round
          </h4>
          {/* Mobile: stacked rounds. Desktop (sm+): horizontal columns, left-to-right */}
          <div className="sm:overflow-x-auto">
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-3 sm:min-w-max">
              {Array.from(bracketRounds.entries()).map(([label, roundMatches]) => (
                <div key={label} className="flex flex-col sm:w-64 sm:shrink-0">
                  <p className="mb-1.5 t-label font-semibold tracking-wide text-gray-400 text-center">
                    {label}
                  </p>
                  <div className="flex flex-1 flex-col justify-around gap-2">
                    {roundMatches.map((m) => (
                      <BracketMatch key={m.id} match={m} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {consolation.length > 0 && (
        <div>
          <h4 className="mb-2 t-caption font-bold uppercase tracking-widest text-gray-400">
            Bronze Match
          </h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {consolation.map((m) => (
              <BracketMatch key={m.id} match={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function groupByEventId(
  matches: TournamentMatch[],
  events: TournamentEvent[],
): Map<string, { name: string; matches: TournamentMatch[] }> {
  const eventNames = new Map(events.map((e) => [e.id, cleanEventName(e)]));
  const groups = new Map<string, { name: string; matches: TournamentMatch[] }>();

  for (const m of matches) {
    const key = m.event_id ?? "unknown";
    if (!groups.has(key)) {
      groups.set(key, {
        name: m.event_id ? (eventNames.get(m.event_id) ?? "Event") : "Event",
        matches: [],
      });
    }
    groups.get(key)!.matches.push(m);
  }
  return groups;
}

export function LiveBracket({
  matches,
  events,
}: {
  matches: TournamentMatch[];
  events: TournamentEvent[];
}) {
  if (matches.length === 0) return null;

  const grouped = groupByEventId(matches, events);
  const eventKeys = Array.from(grouped.keys());
  const [selectedEvent, setSelectedEvent] = useState(eventKeys[0]);

  const liveCount = matches.filter((m) => m.match_start != null && !m.match_completed).length;
  const completedCount = matches.filter((m) => m.winner > 0).length;
  const badgeText = liveCount > 0
    ? `${liveCount} live`
    : completedCount > 0
      ? `${completedCount}/${matches.length} complete`
      : `${matches.length} scheduled`;

  const current = grouped.get(selectedEvent);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      <IntelSectionHeader title="Bracket & Results" badge={badgeText} />

      {eventKeys.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 bg-white px-4 py-2">
          {eventKeys.map((key) => {
            const group = grouped.get(key)!;
            const isSelected = key === selectedEvent;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedEvent(key)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 t-caption font-semibold transition ${
                  isSelected
                    ? "bg-emerald-700 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {group.name}
              </button>
            );
          })}
        </div>
      )}

      {current && <EventBracketView matches={current.matches} />}
    </div>
  );
}
