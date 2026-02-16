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

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
          Events & Field Analysis
        </h3>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{events.length} events</span>
          {totalRegistered > 0 && <span>{totalRegistered} registered</span>}
          {withDupr.length > 0 && (
            <span>{withDupr.length} with DUPR data</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {events.map((event) => (
          <EventCard key={event.id} event={event} userDupr={userDupr} />
        ))}
      </div>
    </div>
  );
}
