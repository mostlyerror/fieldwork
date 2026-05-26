"use client";

import { useState } from "react";
import type { TournamentEvent } from "@/lib/types";
import { FieldStrengthBadge } from "./field-strength-badge";
import { PlayerList } from "./player-list";
import { DuprDistribution } from "./dupr-distribution";

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

  const edge =
    userDupr != null && event.avg_dupr != null
      ? Math.round((userDupr - event.avg_dupr) * 100) / 100
      : null;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={hasPlayers ? () => setExpanded(!expanded) : undefined}
        disabled={!hasPlayers}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:cursor-default"
      >
        {/* Expand indicator */}
        {hasPlayers && (
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 transition-colors group-hover:bg-emerald-100">
            <svg
              className={`h-3.5 w-3.5 text-gray-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}

        {/* Event name + badges */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h4 className="font-bold text-gray-900">{event.name}</h4>
          <FieldStrengthBadge
            avgFieldStrength={event.field_strength ?? undefined}
            maxSandbaggerPct={event.sandbagger_pct ?? undefined}
          />
        </div>

        {/* Stats */}
        <div className="flex flex-shrink-0 items-center gap-3 text-sm">
          {event.registered_count > 0 && (
            <span className="hidden text-gray-400 sm:inline">
              {event.registered_count} {event.event_type === "singles" ? "players" : "teams"}
            </span>
          )}
          {event.avg_dupr != null && (
            <span className="rounded-md bg-gray-50 px-2 py-0.5 font-semibold text-gray-700">
              {event.avg_dupr.toFixed(2)}
            </span>
          )}
          {edge != null && (
            <span
              className={`font-semibold ${
                edge > 0.1
                  ? "text-green-600"
                  : edge < -0.1
                    ? "text-red-500"
                    : "text-amber-600"
              }`}
            >
              {edge > 0 ? "+" : ""}
              {edge.toFixed(2)}
            </span>
          )}
        </div>
      </button>

      {/* Live intel teaser when collapsed */}
      {!expanded && hasPlayers && playersWithLive > 0 && (
        <div
          onClick={() => setExpanded(true)}
          className="flex cursor-pointer items-center gap-2 border-t border-emerald-100 bg-emerald-50/50 px-4 py-2"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700">
            {playersWithLive} live DUPR ratings
          </span>
          {playersWithDrift > 0 && (
            <span className="text-xs text-emerald-600">
              &middot; {playersWithDrift} differ from listed
            </span>
          )}
          <span className="ml-auto text-xs text-emerald-500">
            View players &rarr;
          </span>
        </div>
      )}

      {/* Expanded player details */}
      {expanded && hasPlayers && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-2">
          <DuprDistribution players={event.players!} />
          <PlayerList players={event.players!} />
        </div>
      )}
    </div>
  );
}
