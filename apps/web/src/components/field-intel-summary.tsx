import type { TournamentEvent } from "@/lib/types";
import { FieldStrengthBadge, getFieldStrengthLevel } from "./field-strength-badge";

export function FieldIntelSummary({ events }: { events: TournamentEvent[] }) {
  const withDupr = events.filter((e) => e.avg_dupr != null);
  if (withDupr.length === 0) return null;

  const totalRegistered = events.reduce((sum, e) => sum + e.registered_count, 0);
  const avgDupr =
    withDupr.reduce((sum, e) => sum + e.avg_dupr!, 0) / withDupr.length;

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

  const TAKEAWAYS: Record<string, string> = {
    friendly: "Brackets are playing at or below listed skill levels",
    competitive: "Brackets are playing close to the top of listed skill levels",
    stacked: "Brackets are playing above listed skill levels — expect tough competition",
    sandbagger: "High percentage of players rated above bracket limits",
  };

  return (
    <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/40 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-700">
          Field Intel
        </h3>
        {avgFieldStrength != null && (
          <FieldStrengthBadge
            avgFieldStrength={avgFieldStrength}
            maxSandbaggerPct={maxSandbaggerPct}
            size="md"
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="text-gray-500">Avg DUPR </span>
          <span className="font-bold text-gray-900">{avgDupr.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-gray-500">Registered </span>
          <span className="font-bold text-gray-900">{totalRegistered}</span>
        </div>
        <div>
          <span className="text-gray-500">Events w/ data </span>
          <span className="font-bold text-gray-900">{withDupr.length}/{events.length}</span>
        </div>
        {maxSandbaggerPct != null && maxSandbaggerPct > 0 && (
          <div>
            <span className="text-gray-500">Sandbagger % </span>
            <span className="font-bold text-red-600">{Math.round(maxSandbaggerPct * 100)}%</span>
          </div>
        )}
      </div>

      {level && (
        <p className="mt-2 text-xs text-gray-500">
          {TAKEAWAYS[level]}
        </p>
      )}
    </div>
  );
}
