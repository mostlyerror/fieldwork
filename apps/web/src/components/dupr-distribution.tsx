"use client";

import type { TournamentEvent } from "@/lib/types";
import { eventPeople, eventIntel } from "@/lib/field-intel";

// Snap a rating to the nearest 0.05 bin for stacking
function snapTo(rating: number, step = 0.05): number {
  return Math.round(rating / step) * step;
}

type DotColor = "green" | "red" | "gray";

interface PlotPlayer {
  name: string;
  rating: number;
  snapped: number;
  color: DotColor;
}

// Fallback when an event has no declared skill window: densest 0.5-wide bucket.
function deriveBracket(ratings: number[]): { low: number; high: number } {
  if (ratings.length === 0) return { low: 2.0, high: 5.0 };
  const bucketSize = 0.5;
  const minR = Math.min(...ratings);
  const maxR = Math.max(...ratings);
  let bestLow = Math.floor(minR / bucketSize) * bucketSize;
  let bestCount = 0;
  for (let low = Math.floor(minR / bucketSize) * bucketSize; low <= maxR; low += bucketSize) {
    const count = ratings.filter((r) => r >= low && r < low + bucketSize).length;
    if (count > bestCount) {
      bestCount = count;
      bestLow = low;
    }
  }
  return { low: bestLow, high: bestLow + bucketSize };
}

export function DuprDistribution({ event }: { event: TournamentEvent }) {
  const people = eventPeople(event).filter((p) => p.rating != null);
  if (people.length === 0) return null;

  const intel = eventIntel(event);
  const hasLive = people.some((p) => p.live != null);

  // Bracket band: real skill window when known, else densest cluster.
  const allRatings = people.map((p) => p.rating!);
  const bracket =
    intel.skillMin != null && intel.skillMax != null
      ? { low: intel.skillMin, high: intel.skillMax }
      : deriveBracket(allRatings);

  const rated: PlotPlayer[] = people.map((p) => {
    const rating = p.rating!;
    let color: DotColor = "green";
    if (rating < bracket.low - 0.05) color = "gray";
    else if (rating > bracket.high + 0.05) color = "red";
    return { name: p.name, rating, snapped: snapTo(rating), color };
  });

  const avg = allRatings.reduce((s, r) => s + r, 0) / allRatings.length;
  const minRating = Math.min(...allRatings);
  const maxRating = Math.max(...allRatings);

  // Number line range
  const lineMin = 2.0;
  const lineMax = Math.max(Math.ceil((maxRating + 0.5) / 0.5) * 0.5, bracket.high + 0.5);
  const lineRange = lineMax - lineMin;
  const pct = (r: number) => ((r - lineMin) / lineRange) * 100;

  const ticks: number[] = [];
  for (let t = lineMin; t <= lineMax; t = Math.round((t + 0.5) * 10) / 10) ticks.push(t);

  // Stack dots by snapped value
  const stackMap: Record<number, PlotPlayer[]> = {};
  for (const p of rated) (stackMap[p.snapped] ??= []).push(p);

  interface DotPos {
    player: PlotPlayer;
    xPct: number;
    col: number;
  }
  const dots: DotPos[] = [];
  for (const [keyStr, stack] of Object.entries(stackMap)) {
    const xPct = pct(parseFloat(keyStr));
    stack.forEach((player, idx) => dots.push({ player, xPct, col: idx }));
  }

  const maxStack = Math.max(...Object.values(stackMap).map((s) => s.length), 1);
  const DOT_PX = 12;
  const DOT_GAP = 2;
  const chartHeight = Math.max(40, (DOT_PX + DOT_GAP) * maxStack + 12);

  const bracketLeftPct = Math.max(0, pct(bracket.low));
  const bracketRightPct = Math.min(100, pct(bracket.high));
  const avgPct = Math.min(100, Math.max(0, pct(avg)));

  const colorClass: Record<DotColor, string> = {
    green: "bg-emerald-500 ring-emerald-600",
    red: "bg-red-400 ring-red-500",
    gray: "bg-gray-300 ring-gray-400",
  };

  const showClassification =
    intel.skillMin != null && intel.skillMax != null && (intel.inRange + intel.below + intel.above) > 0;

  return (
    <div className="my-4 max-w-full rounded-xl bg-gray-50/80 p-4">
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Rating spread</p>
        <div className="flex items-center gap-2">
          {hasLive && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              Live
            </span>
          )}
          <span className="text-xs text-gray-400">{rated.length} rated</span>
        </div>
      </div>

      {/* Sub: count · avg · range */}
      <p className="mb-2.5 text-xs font-medium tabular-nums text-gray-400">
        {rated.length} player{rated.length !== 1 ? "s" : ""} · avg {avg.toFixed(2)} · range {minRating.toFixed(1)}–{maxRating.toFixed(1)}
      </p>

      {/* Takeaway sentence */}
      {showClassification && (
        <p className="mb-3 text-[13px] font-semibold tabular-nums text-gray-600">
          <b className="font-extrabold text-gray-900">{intel.inRange}</b> in range
          {intel.below > 0 && (
            <>
              {" · "}
              <b className="font-extrabold text-gray-900">{intel.below}</b> below
            </>
          )}
          {intel.above > 0 && (
            <>
              {" · "}
              <b className="font-extrabold text-red-600">{intel.above}</b>
              <span className="text-red-600"> above the {intel.skillMax!.toFixed(1)} ceiling</span>
            </>
          )}
        </p>
      )}

      {/* Dot plot */}
      <div className="relative w-full max-w-full select-none overflow-hidden">
        <div className="relative w-full" style={{ height: `${chartHeight}px` }}>
          {/* Bracket band */}
          <div
            className="absolute bottom-0 top-3 rounded-lg bg-emerald-100/70"
            style={{ left: `${bracketLeftPct}%`, width: `${bracketRightPct - bracketLeftPct}%` }}
          >
            <span className="absolute left-0 right-0 top-1 text-center text-[8.5px] font-bold uppercase tracking-wider text-emerald-600/70">
              Bracket
            </span>
          </div>

          {/* Avg reference line + label */}
          <div className="absolute bottom-0 top-0 border-l border-dashed border-gray-700/50" style={{ left: `${avgPct}%` }} />
          <span
            className="absolute top-0 -translate-x-1/2 text-[9.5px] font-extrabold tabular-nums text-gray-800"
            style={{ left: `${avgPct}%` }}
          >
            avg {avg.toFixed(2)}
          </span>

          {/* Dots */}
          {dots.map((d, i) => {
            const bottomPx = d.col * (DOT_PX + DOT_GAP) + 4;
            return (
              <div
                key={`${d.player.name}-${i}`}
                title={`${d.player.name} · ${d.player.rating.toFixed(2)}`}
                className={`absolute cursor-default rounded-full ring-1 transition-transform hover:z-10 hover:scale-150 ${colorClass[d.player.color]}`}
                style={{
                  width: `${DOT_PX}px`,
                  height: `${DOT_PX}px`,
                  left: `calc(${d.xPct}% - ${DOT_PX / 2}px)`,
                  bottom: `${bottomPx}px`,
                  zIndex: d.col + 1,
                }}
              />
            );
          })}
        </div>

        {/* Number line */}
        <div className="relative mt-1 h-px w-full bg-gray-300">
          {ticks.map((t) => {
            const isWhole = Number.isInteger(t);
            return (
              <div
                key={t}
                className="absolute flex flex-col items-center"
                style={{ left: `${pct(t)}%`, transform: "translateX(-50%)" }}
              >
                <div className={isWhole ? "h-2 w-px bg-gray-500" : "h-1.5 w-px bg-gray-300"} />
                {isWhole && <span className="mt-0.5 text-xs font-semibold tabular-nums text-gray-500">{t.toFixed(1)}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend with counts */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium tabular-nums text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          In bracket {showClassification ? intel.inRange : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gray-300" />
          Below {showClassification ? intel.below : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          Above {showClassification ? intel.above : ""}
        </span>
      </div>
    </div>
  );
}
