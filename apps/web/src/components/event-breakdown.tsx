"use client";

import { useState } from "react";
import type { TournamentEvent } from "@/lib/types";
import { EventCard } from "./event-card";
import { FieldIntelSummary } from "./field-intel-summary";
import { IntelSectionHeader } from "@/components/intel-section-header";
import { DuprDistribution } from "./dupr-distribution";
import { PlayerList } from "./player-list";
import { FieldStrengthBadge } from "./field-strength-badge";
import { effectiveAvgDupr, avgDuprPair } from "@/lib/dupr-utils";
import { AvgDuprCell } from "./avg-dupr-cell";

function categorizeEvent(event: TournamentEvent): string {
  const name = event.name.toLowerCase();
  if (name.includes("mixed")) return "Mixed Doubles";
  if (name.includes("women") || name.includes("girl")) return "Women's";
  if (name.includes("men") || name.includes("boy")) return "Men's";
  if (name.includes("senior")) return "Seniors";
  return "Other";
}

function groupEvents(events: TournamentEvent[]): Map<string, TournamentEvent[]> {
  const groups = new Map<string, TournamentEvent[]>();
  const order = ["Men's", "Women's", "Mixed Doubles", "Seniors", "Other"];

  for (const event of events) {
    const cat = categorizeEvent(event);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(event);
  }

  const sorted = new Map<string, TournamentEvent[]>();
  for (const key of order) {
    if (groups.has(key)) sorted.set(key, groups.get(key)!);
  }
  return sorted;
}

export function EventBreakdown({
  events,
  userDupr,
}: {
  events: TournamentEvent[];
  userDupr?: number;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    events[0]?.id ?? null
  );

  if (events.length === 0) return null;

  const selectedEvent =
    events.find((e) => e.id === selectedEventId) ?? events[0];

  const totalLiveDupr = events.reduce(
    (sum, e) =>
      sum + (e.players?.filter((p) => p.live_dupr_verified === true).length ?? 0),
    0
  );
  const badgeText = totalLiveDupr > 0 ? `${totalLiveDupr} live ratings` : undefined;

  const hasPlayers = selectedEvent.players && selectedEvent.players.length > 0;
  const grouped = groupEvents(events);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      <IntelSectionHeader title="Field Intelligence" badge={badgeText} />
      <FieldIntelSummary events={events} />

      {/* Mobile: stacked expandable cards */}
      <div className="lg:hidden">
        {events.map((event) => (
          <EventCard key={event.id} event={event} userDupr={userDupr} />
        ))}
      </div>

      {/* Desktop: master-detail with grouped events */}
      <div className="hidden lg:grid lg:grid-cols-[340px_1fr]" style={{ height: "clamp(400px, 70vh, 800px)" }}>
        {/* Left panel: grouped event list */}
        <div className="overflow-y-auto border-r border-gray-200 bg-white">
          {Array.from(grouped.entries()).map(([category, categoryEvents]) => (
            <div key={category}>
              <div className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50 px-4 py-2">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {category}
                </span>
              </div>
              {categoryEvents.map((event) => {
                const isSelected = event.id === selectedEventId;
                const eventLiveCount =
                  event.players?.filter((p) => p.live_dupr_verified === true)
                    .length ?? 0;

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    className={`w-full border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 ${
                      isSelected
                        ? "border-l-3 border-l-emerald-700 bg-emerald-50 pl-3.5"
                        : "border-l-3 border-l-transparent hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`text-sm font-bold leading-snug ${
                        isSelected ? "text-emerald-900" : "text-gray-900"
                      }`}
                    >
                      {event.name}
                    </span>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                      {event.registered_count > 0 && (
                        <span>
                          {event.registered_count}{" "}
                          {event.event_type === "singles" ? "players" : "teams"}
                        </span>
                      )}
                      {effectiveAvgDupr(event) != null && (
                        <AvgDuprCell pair={avgDuprPair(event)} size="sm" />
                      )}
                      {eventLiveCount > 0 && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {eventLiveCount} live
                        </span>
                      )}
                      <FieldStrengthBadge
                        avgFieldStrength={event.field_strength ?? undefined}
                        maxSandbaggerPct={event.sandbagger_pct ?? undefined}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right panel: selected event details */}
        <div className="overflow-y-auto bg-white p-6">
          <h3 className="text-xl font-extrabold tracking-tight text-gray-900">
            {selectedEvent.name}
          </h3>

          <div className="mt-2 flex flex-wrap gap-5 text-sm text-gray-500">
            {selectedEvent.registered_count > 0 && (
              <span>
                <span className="font-bold text-gray-900">
                  {selectedEvent.registered_count}
                </span>{" "}
                {selectedEvent.event_type === "singles" ? "players" : "teams"}
              </span>
            )}
            {effectiveAvgDupr(selectedEvent) != null && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-gray-500">Avg Rating</span>{" "}
                <AvgDuprCell pair={avgDuprPair(selectedEvent)} size="md" />
              </span>
            )}
            {selectedEvent.skill_level_min != null &&
              selectedEvent.skill_level_max != null && (
                <span>
                  Skill{" "}
                  <span className="font-bold text-gray-900">
                    {selectedEvent.skill_level_min}–{selectedEvent.skill_level_max}
                  </span>
                </span>
              )}
            <FieldStrengthBadge
              avgFieldStrength={selectedEvent.field_strength ?? undefined}
              maxSandbaggerPct={selectedEvent.sandbagger_pct ?? undefined}
              size="md"
            />
          </div>

          {hasPlayers ? (
            <div className="mt-4">
              <DuprDistribution players={selectedEvent.players!} />
              <PlayerList players={selectedEvent.players!} />
            </div>
          ) : (
            <p className="mt-12 text-center text-sm text-gray-400">
              No player data available for this event.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
