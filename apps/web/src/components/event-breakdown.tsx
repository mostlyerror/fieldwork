"use client";

import type { TournamentEvent } from "@/lib/types";
import { EventCard } from "./event-card";

export function EventBreakdown({
  events,
  userDupr,
}: {
  events: TournamentEvent[];
  userDupr?: number;
}) {
  if (events.length === 0) return null;

  const totalRegistered = events.reduce((sum, e) => sum + e.registered_count, 0);
  const withDupr = events.filter((e) => e.avg_dupr != null);
  const totalLiveDupr = events.reduce(
    (sum, e) => sum + (e.players?.filter((p) => p.live_dupr_verified === true).length ?? 0),
    0
  );

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            Events & Players
          </h2>
          <p className="text-sm text-gray-400">
            {events.length} events &middot; {totalRegistered} registered
            {withDupr.length > 0 && <> &middot; {withDupr.length} with DUPR data</>}
          </p>
        </div>
        {totalLiveDupr > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 ring-1 ring-emerald-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">
              {totalLiveDupr} live ratings from DUPR
            </span>
          </div>
        )}
      </div>

      {/* Event cards */}
      <div className="space-y-2">
        {events.map((event) => (
          <EventCard key={event.id} event={event} userDupr={userDupr} />
        ))}
      </div>
    </div>
  );
}
