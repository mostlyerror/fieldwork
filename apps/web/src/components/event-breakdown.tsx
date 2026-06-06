"use client";

import { useState } from "react";
import type { TournamentEvent } from "@/lib/types";
import { EventCard } from "./event-card";
import { IntelSectionHeader } from "@/components/intel-section-header";
import { DuprDistribution } from "./dupr-distribution";
import { TeamLeaderboard } from "./team-leaderboard";
import { FieldHonesty } from "./field-honesty";
import { cleanEventName } from "@/lib/event-name";
import { FieldStrengthBadge } from "./field-strength-badge";
import { effectiveAvgDupr, avgDuprPair } from "@/lib/dupr-utils";
import { registrantLabel } from "@/lib/field-intel";
import { AvgDuprCell } from "./avg-dupr-cell";
import { ScrollFade } from "./scroll-fade";

/** Per-bracket start, shown faithfully from the source label (already venue-local).
 *  "Jun 7 2026 8:30 AM" -> "Jun 7 · 8:30 AM"; "Jun 13 2026 Morning" -> "Jun 13 · Morning". */
function formatEventStart(event: TournamentEvent): string | null {
  if (!event.start_time_raw) return null;
  return event.start_time_raw.replace(/\s+\d{4}\s+/, " · ").trim();
}

function categorizeEvent(event: TournamentEvent): string {
  const name = event.name.toLowerCase();
  if (name.includes("mixed")) return "Mixed Doubles";
  if (name.includes("women") || name.includes("girl")) return "Women's";
  if (name.includes("men") || name.includes("boy")) return "Men's";
  if (name.includes("senior")) return "Seniors";
  return "Other";
}

const CATEGORY_ORDER = ["Men's", "Women's", "Mixed Doubles", "Seniors", "Other"];
const CAT_RANK: Record<string, number> = Object.fromEntries(
  CATEGORY_ORDER.map((c, i) => [c, i]),
);

/**
 * Stable, content-independent ordering: category first, then skill window
 * ascending. The same on every tournament so a player always finds their
 * bracket in the same place — field strength is conveyed by the badges, never
 * by position.
 */
function standardEventOrder(a: TournamentEvent, b: TournamentEvent): number {
  const ra = CAT_RANK[categorizeEvent(a)] ?? 99;
  const rb = CAT_RANK[categorizeEvent(b)] ?? 99;
  if (ra !== rb) return ra - rb;
  const fa = a.skill_level_min ?? 0;
  const fb = b.skill_level_min ?? 0;
  if (fa !== fb) return fa - fb;
  return (a.skill_level_max ?? 99) - (b.skill_level_max ?? 99);
}

function groupEvents(events: TournamentEvent[]): Map<string, TournamentEvent[]> {
  const groups = new Map<string, TournamentEvent[]>();

  for (const event of events) {
    const cat = categorizeEvent(event);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(event);
  }

  const sorted = new Map<string, TournamentEvent[]>();
  for (const key of CATEGORY_ORDER) {
    if (groups.has(key)) {
      sorted.set(key, groups.get(key)!.slice().sort(standardEventOrder));
    }
  }
  return sorted;
}

export function EventBreakdown({ events }: { events: TournamentEvent[] }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  if (events.length === 0) return null;

  const orderedEvents = [...events].sort(standardEventOrder);
  const selectedEvent =
    events.find((e) => e.id === selectedEventId) ?? orderedEvents[0];

  const totalLiveDupr = events.reduce(
    (sum, e) =>
      sum + (e.players?.filter((p) => p.live_dupr_verified === true).length ?? 0),
    0
  );
  const badgeText = totalLiveDupr > 0 ? `${totalLiveDupr} live ratings` : undefined;

  const hasPlayers = selectedEvent.players && selectedEvent.players.length > 0;
  const grouped = groupEvents(events);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/70 shadow-card sm:rounded-3xl">
      <IntelSectionHeader title="Field Intelligence" badge={badgeText} />

      {/* Mobile: stacked expandable cards */}
      <div className="lg:hidden">
        {orderedEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {/* Desktop: master-detail with grouped events */}
      <div className="hidden lg:grid lg:grid-cols-[340px_1fr]" style={{ height: "clamp(400px, 70vh, 800px)" }}>
        {/* Left panel: grouped event list */}
        <div className="min-h-0 border-r border-gray-200">
          <ScrollFade className="bg-white">
          {Array.from(grouped.entries()).map(([category, categoryEvents]) => (
            <div key={category}>
              <div className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50 px-4 py-2">
                <span className="t-caption font-bold uppercase tracking-widest text-gray-400">
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
                      className={`t-body font-bold ${
                        isSelected ? "text-emerald-900" : "text-gray-900"
                      }`}
                    >
                      {cleanEventName(event)}
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 t-caption text-gray-400">
                      {formatEventStart(event) && (
                        <span className="flex items-center gap-1 font-semibold text-emerald-700">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                          {formatEventStart(event)}
                        </span>
                      )}
                      {event.registered_count > 0 && (
                        <span>{registrantLabel(event.registered_count, event.event_type)}</span>
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
          </ScrollFade>
        </div>

        {/* Right panel: selected event details */}
        <ScrollFade className="bg-white p-6">
          <h3 className="t-h2 text-gray-900">
            {cleanEventName(selectedEvent)}
          </h3>

          <div className="mt-2 flex flex-wrap gap-5 t-body text-gray-500">
            {formatEventStart(selectedEvent) && (
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                {formatEventStart(selectedEvent)}
              </span>
            )}
            {selectedEvent.registered_count > 0 && (
              <span className="font-bold text-gray-900">
                {registrantLabel(selectedEvent.registered_count, selectedEvent.event_type)}
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
            <div className="mt-4 space-y-3">
              <FieldHonesty event={selectedEvent} />
              <DuprDistribution event={selectedEvent} />
              <TeamLeaderboard event={selectedEvent} />
            </div>
          ) : (
            <p className="mt-12 text-center t-body text-gray-400">
              No player data available for this event.
            </p>
          )}
        </ScrollFade>
      </div>
    </div>
  );
}
