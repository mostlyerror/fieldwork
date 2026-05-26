"use client";

import type { TournamentEvent } from "@/lib/types";
import { EventCard } from "./event-card";
import { FieldIntelSummary } from "./field-intel-summary";
import { IntelSectionHeader } from "@/components/intel-section-header";

export function EventBreakdown({
  events,
  userDupr,
}: {
  events: TournamentEvent[];
  userDupr?: number;
}) {
  if (events.length === 0) return null;

  const totalLiveDupr = events.reduce(
    (sum, e) => sum + (e.players?.filter((p) => p.live_dupr_verified === true).length ?? 0),
    0
  );

  const badgeText = totalLiveDupr > 0 ? `${totalLiveDupr} live ratings` : undefined;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      <IntelSectionHeader title="Field Intelligence" badge={badgeText} />
      <FieldIntelSummary events={events} />
      <div>
        {events.map((event) => (
          <EventCard key={event.id} event={event} userDupr={userDupr} />
        ))}
      </div>
    </div>
  );
}
