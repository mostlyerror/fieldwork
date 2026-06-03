"use client";

import { useState } from "react";
import type { TournamentEvent } from "@/lib/types";
import { TeamLeaderboard } from "./team-leaderboard";
import { DuprDistribution } from "./dupr-distribution";
import { FieldHonesty } from "./field-honesty";
import { FieldStrip } from "./field-strip";
import { eventIntel, registrantLabel } from "@/lib/field-intel";
import { cleanEventName } from "@/lib/event-name";

/** Listed → live average transition shown on the right of the card header. */
function RateTransition({ listed, live }: { listed: number | null; live: number | null }) {
  if (live != null && listed != null && Math.abs(live - listed) > 0.05) {
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="t-small tabular-nums text-gray-400 line-through">{listed.toFixed(2)}</span>
        <span className="t-h2 tabular-nums text-emerald-700">{live.toFixed(2)}</span>
      </div>
    );
  }
  const value = live ?? listed;
  if (value == null) return null;
  return (
    <span className={`t-h2 tabular-nums ${live != null ? "text-emerald-700" : "text-gray-900"}`}>
      {value.toFixed(2)}
    </span>
  );
}

export function EventCard({ event }: { event: TournamentEvent }) {
  const hasPlayers = (event.players?.length ?? 0) > 0;
  const [expanded, setExpanded] = useState(false);
  const intel = eventIntel(event);

  // The over-cap signal is carried by the strip's red squares now, so flags are
  // just live-coverage info.
  const showFlags = hasPlayers && intel.ratedLiveCount > 0;

  return (
    <div className="border-b border-gray-100 bg-white last:border-b-0">
      <button
        type="button"
        onClick={hasPlayers ? () => setExpanded((v) => !v) : undefined}
        disabled={!hasPlayers}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-white sm:px-5"
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

        <div className="min-w-0 flex-1">
          <div className="truncate t-body font-bold tracking-tight text-gray-900">{cleanEventName(event)}</div>
          {event.registered_count > 0 && (
            <div className="mt-0.5 t-caption text-gray-400">
              {registrantLabel(event.registered_count, event.event_type)}
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          <RateTransition listed={intel.listedAvg} live={intel.liveAvg} />
        </div>
      </button>

      {showFlags && (
        <div
          onClick={!expanded ? () => setExpanded(true) : undefined}
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-3 pl-11 sm:px-5 sm:pl-12 ${!expanded ? "cursor-pointer" : ""}`}
        >
          {intel.ratedLiveCount > 0 && (
            <span className="flex items-center gap-1.5 t-caption font-semibold text-gray-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {intel.ratedLiveCount} of {event.registered_count > 0 && intel.unit === "players" ? event.registered_count : intel.totalPeople} rated live
            </span>
          )}
          {intel.differCount > 0 && (
            <span className="t-caption text-gray-400">· {intel.differCount} differ from listed</span>
          )}
        </div>
      )}

      {!expanded && hasPlayers && (
        <div
          onClick={() => setExpanded(true)}
          className="cursor-pointer px-4 pb-3.5 pl-11 sm:px-5 sm:pl-12"
        >
          <FieldStrip event={event} />
        </div>
      )}

      {expanded && hasPlayers && (
        <div className="border-t border-gray-100 bg-[#fbfcfb] px-4 pb-4 pt-3 sm:px-5">
          <FieldHonesty event={event} />
          <DuprDistribution event={event} />
          <TeamLeaderboard event={event} />
        </div>
      )}
    </div>
  );
}
