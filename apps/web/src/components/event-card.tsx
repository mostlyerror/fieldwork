"use client";

import { useState } from "react";
import type { TournamentEvent } from "@/lib/types";
import { FieldStrengthBadge } from "./field-strength-badge";
import { PlayerList } from "./player-list";

export function EventCard({
  event,
  userDupr,
}: {
  event: TournamentEvent;
  userDupr?: number;
}) {
  const hasPlayers = event.players && event.players.length > 0;
  const [expanded, setExpanded] = useState(hasPlayers && event.players!.length < 20);

  const edge =
    userDupr != null && event.avg_dupr != null
      ? Math.round((userDupr - event.avg_dupr) * 100) / 100
      : null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white transition-shadow hover:shadow-sm">
      <div
        role={hasPlayers ? "button" : undefined}
        onClick={hasPlayers ? () => setExpanded(!expanded) : undefined}
        className={`flex w-full items-center justify-between px-4 py-3 text-left ${hasPlayers ? "cursor-pointer" : ""}`}
      >
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <h4 className="font-semibold text-gray-900">{event.name}</h4>
          <FieldStrengthBadge
            avgFieldStrength={event.field_strength ?? undefined}
            maxSandbaggerPct={event.sandbagger_pct ?? undefined}
          />
        </div>

        <div className="ml-4 flex items-center gap-3 text-sm text-gray-500">
          {event.registered_count > 0 && (
            <span>
              {event.registered_count} {event.event_type === "singles" ? "players" : "teams"}
            </span>
          )}
          {event.avg_dupr != null && (
            <span className="font-medium text-gray-700">
              Avg {event.avg_dupr.toFixed(2)}
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
          {hasPlayers && (
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>

      {expanded && hasPlayers && (
        <div className="border-t border-gray-50 px-4 pb-3">
          <PlayerList players={event.players!} />
        </div>
      )}
    </div>
  );
}
