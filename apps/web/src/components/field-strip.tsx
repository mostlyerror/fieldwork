import type { TournamentEvent } from "@/lib/types";
import { eventPeople, classifyZone, type Zone } from "@/lib/field-intel";

const ZONE_FILL: Record<Zone, string> = {
  in: "#1f9d57",
  below: "#aeb6bc",
  above: "#e0483b",
};

// Windowless events (Beginner / junior brackets) have no floor or cap.
const NEUTRAL = "#9aa6a0";

/**
 * Collapsed "unit strip" — every rated player as one zone-colored square in a
 * single sorted row, with the bracket window marked underneath. The compact form
 * of the unit-square chart for feed / bracket-list rows. Squares flex to fill, so
 * it never overflows: small fields read as chunky tiles, big fields as fine bars.
 */
export function FieldStrip({ event }: { event: TournamentEvent }) {
  const rated = eventPeople(event)
    .filter((p) => p.rating != null)
    .sort((a, b) => a.rating! - b.rating!);
  if (rated.length === 0) return null;

  const hasWindow = event.skill_level_min != null || event.skill_level_max != null;
  const zones = rated.map((p) => classifyZone(p.rating!, event.skill_level_min, event.skill_level_max));
  const firstIn = zones.indexOf("in");
  const lastIn = zones.lastIndexOf("in");
  const n = rated.length;

  return (
    <div className="w-full">
      <div className="flex gap-[2px]">
        {zones.map((z, i) => (
          <span
            key={i}
            className="h-3.5 min-w-[3px] flex-1 rounded-[2px]"
            style={{ background: hasWindow ? ZONE_FILL[z] : NEUTRAL, opacity: hasWindow && z === "above" ? 0.92 : 1 }}
          />
        ))}
      </div>
      {hasWindow && firstIn >= 0 && (
        <div className="relative mt-1 h-3">
          <div
            className="absolute top-0 h-0.5 rounded-full"
            style={{
              left: `${(firstIn / n) * 100}%`,
              width: `${((lastIn - firstIn + 1) / n) * 100}%`,
              background: "rgba(6,95,70,0.45)",
            }}
          />
          <span
            className="absolute top-[3px] text-[8px] font-bold uppercase tracking-wider text-emerald-800"
            style={{ left: `${(firstIn / n) * 100}%` }}
          >
            window
          </span>
        </div>
      )}
    </div>
  );
}
