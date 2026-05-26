"use client";

import { useState } from "react";
import type { TournamentEvent } from "@/lib/types";
import { FieldStrengthBadge } from "./field-strength-badge";
import { PlayerList } from "./player-list";
import { DuprDistribution } from "./dupr-distribution";
import { effectiveAvgDupr, avgDuprPair } from "@/lib/dupr-utils";
import { AvgDuprCell } from "./avg-dupr-cell";

export function EventCard({
  event,
  userDupr,
}: {
  event: TournamentEvent;
  userDupr?: number;
}) {
  const hasPlayers = event.players && event.players.length > 0;
  const [expanded, setExpanded] = useState(false);

  const playersWithLive = event.players?.filter((p) => p.live_dupr_verified === true).length ?? 0;
  const playersWithDrift = event.players?.filter(
    (p) => p.live_dupr_verified === true && p.live_dupr != null && p.dupr_rating != null && Math.abs(p.live_dupr - p.dupr_rating) > 0.05
  ).length ?? 0;

  return (
    <div className="border-b border-gray-100 last:border-b-0 bg-white">
      <button
        type="button"
        onClick={hasPlayers ? () => setExpanded(!expanded) : undefined}
        disabled={!hasPlayers}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-white"
      >
        {hasPlayers && (
          <svg
            className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-bold text-gray-900">{event.name}</span>
          <FieldStrengthBadge
            avgFieldStrength={event.field_strength ?? undefined}
            maxSandbaggerPct={event.sandbagger_pct ?? undefined}
          />
        </div>

        <div className="flex flex-shrink-0 items-center gap-3 text-sm text-gray-400">
          {event.registered_count > 0 && (
            <span className="hidden sm:inline">
              {event.registered_count} {event.event_type === "singles" ? "players" : "teams"}
            </span>
          )}
          {effectiveAvgDupr(event) != null && (
            <AvgDuprCell pair={avgDuprPair(event)} size="sm" />
          )}
        </div>
      </button>

      {!expanded && hasPlayers && playersWithLive > 0 && (
        <div
          onClick={() => setExpanded(true)}
          className="flex cursor-pointer items-center gap-2 border-t border-gray-50 px-5 py-2 pl-12"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700">
            {playersWithLive} live ratings
          </span>
          {playersWithDrift > 0 && (
            <span className="text-xs text-emerald-600">
              · {playersWithDrift} differ from listed
            </span>
          )}
          <span className="ml-auto text-xs text-emerald-500">
            View →
          </span>
        </div>
      )}

      {expanded && hasPlayers && (
        <div className="border-t border-gray-100 px-5 pb-4 pt-2">
          <DuprDistribution players={event.players!} />
          <PlayerList players={event.players!} />
        </div>
      )}
    </div>
  );
}
