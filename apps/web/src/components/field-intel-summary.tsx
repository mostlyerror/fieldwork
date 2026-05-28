import type { TournamentEvent } from "@/lib/types";
import { getFieldStrengthLevel } from "./field-strength-badge";
import { effectiveAvgDupr, avgDuprPair } from "@/lib/dupr-utils";
import { AvgDuprCell } from "./avg-dupr-cell";

function getSandbaggerEvents(events: TournamentEvent[]): TournamentEvent[] {
  return events.filter(
    (e) => e.sandbagger_pct != null && e.sandbagger_pct > 0.2
  );
}

export function FieldIntelSummary({ events }: { events: TournamentEvent[] }) {
  const eventAvgs = events.map((e) => ({ event: e, avg: effectiveAvgDupr(e) }));
  const withDupr = eventAvgs.filter((ea) => ea.avg != null);
  if (withDupr.length === 0) return null;

  const totalRegistered = events.reduce((sum, e) => sum + e.registered_count, 0);
  const avgDupr =
    withDupr.reduce((sum, ea) => sum + ea.avg!, 0) / withDupr.length;

  const withListedDupr = events.filter((e) => e.avg_dupr != null);
  const listedAvgDupr = withListedDupr.length > 0
    ? Math.round((withListedDupr.reduce((sum, e) => sum + e.avg_dupr!, 0) / withListedDupr.length) * 100) / 100
    : null;
  const hasLiveData = events.some((e) => avgDuprPair(e).hasLiveData);
  const summaryPair = { listed: listedAvgDupr, live: hasLiveData ? Math.round(avgDupr * 100) / 100 : null, hasLiveData };

  const fieldStrengths = events
    .map((e) => e.field_strength)
    .filter((f): f is number => f != null);
  const avgFieldStrength =
    fieldStrengths.length > 0
      ? fieldStrengths.reduce((a, b) => a + b, 0) / fieldStrengths.length
      : undefined;

  const sandbaggerPcts = events
    .map((e) => e.sandbagger_pct)
    .filter((s): s is number => s != null && s > 0);
  const maxSandbaggerPct =
    sandbaggerPcts.length > 0 ? Math.max(...sandbaggerPcts) : undefined;

  const level = getFieldStrengthLevel(avgFieldStrength, maxSandbaggerPct);
  const sandbaggerEvents = getSandbaggerEvents(events);
  const isSandbaggerAlert = level === "sandbagger" || (maxSandbaggerPct != null && maxSandbaggerPct > 0.3);

  const TAKEAWAYS: Record<string, string> = {
    friendly: "Brackets are playing at or below listed skill levels — good for newer competitors.",
    competitive: "Brackets are playing close to the top of listed skill levels.",
    stacked: "Brackets are playing above listed skill levels — expect tough competition.",
    sandbagger: "High percentage of players rated above bracket limits.",
  };

  return (
    <div className="border-b border-gray-100 bg-white px-4 sm:px-5 py-4">
      {isSandbaggerAlert && sandbaggerEvents.length > 0 && (
        <p className="mb-3 text-sm font-semibold text-red-700">
          ⚠ {sandbaggerEvents.length} bracket{sandbaggerEvents.length !== 1 ? "s" : ""} with 20%+ players rated above the skill cap
        </p>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-2 sm:gap-x-6 text-sm">
        <div className="inline-flex items-center gap-1.5">
          <span className="text-gray-400">Avg Rating </span>
          <AvgDuprCell pair={summaryPair} size="md" />
        </div>
        <div>
          <span className="text-gray-400">Registered </span>
          <span className="font-bold text-gray-900">{totalRegistered}</span>
        </div>
        <div>
          <span className="text-gray-400">Events w/ data </span>
          <span className="font-bold text-gray-900">{withDupr.length}/{events.length}</span>
        </div>
        {maxSandbaggerPct != null && maxSandbaggerPct > 0 && (
          <div>
            <span className="text-gray-400">Sandbagger % </span>
            <span className="font-bold text-red-600">{Math.round(maxSandbaggerPct * 100)}%</span>
          </div>
        )}
      </div>

      {level && (
        <p className="mt-2 text-xs text-gray-400 italic">
          {TAKEAWAYS[level]}
        </p>
      )}
    </div>
  );
}
