"use client";

import type { EventPlayer } from "@/lib/types";

// Snap a rating to the nearest 0.05 bin for stacking
function snapTo(rating: number, step = 0.05): number {
  return Math.round(rating / step) * step;
}

interface PlotPlayer {
  name: string;
  rating: number;
  snapped: number;
  hasLive: boolean;
  color: "green" | "red" | "gray";
}

function deriveBracket(ratings: number[]): { low: number; high: number } {
  if (ratings.length === 0) return { low: 2.0, high: 5.0 };

  // Build 0.5-wide buckets and find the densest one
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

export function DuprDistribution({ players }: { players: EventPlayer[] }) {
  // Build rated player list
  const rated: PlotPlayer[] = players
    .flatMap((p) => {
      const rating = p.live_dupr ?? p.dupr_rating;
      if (rating == null) return [];
      const player: PlotPlayer = {
        name: p.player_name,
        rating,
        snapped: snapTo(rating),
        hasLive: p.live_dupr != null,
        color: "gray", // placeholder, set below
      };
      return [player];
    });

  if (rated.length === 0) return null;

  const hasLive = players.some((p) => p.live_dupr != null);

  // Derive bracket from densest cluster
  const allRatings = rated.map((p) => p.rating);
  const bracket = deriveBracket(allRatings);

  // Color code relative to bracket
  for (const p of rated) {
    if (p.rating < bracket.low - 0.05) {
      p.color = "gray";
    } else if (p.rating > bracket.high + 0.05) {
      p.color = "red";
    } else {
      p.color = "green";
    }
  }

  // Summary stats
  const avg = allRatings.reduce((s, r) => s + r, 0) / allRatings.length;
  const minRating = Math.min(...allRatings);
  const maxRating = Math.max(...allRatings);

  // Number line range
  const lineMin = 2.0;
  const lineMax = Math.ceil((maxRating + 0.5) / 0.5) * 0.5;
  const lineRange = lineMax - lineMin;

  // Tick marks every 0.5
  const ticks: number[] = [];
  for (let t = lineMin; t <= lineMax; t = Math.round((t + 0.5) * 10) / 10) {
    ticks.push(t);
  }

  // Stack dots: group by snapped value, assign vertical slot
  const stackMap: Record<number, PlotPlayer[]> = {};
  for (const p of rated) {
    const key = p.snapped;
    if (!stackMap[key]) stackMap[key] = [];
    stackMap[key].push(p);
  }

  // Build dot positions: each dot gets (x%, column index in its stack)
  interface DotPos {
    player: PlotPlayer;
    xPct: number;
    col: number; // 0-indexed from bottom
    total: number; // total stack height at this x
  }

  const dots: DotPos[] = [];
  for (const [keyStr, stack] of Object.entries(stackMap)) {
    const key = parseFloat(keyStr);
    const xPct = ((key - lineMin) / lineRange) * 100;
    stack.forEach((player, idx) => {
      dots.push({ player, xPct, col: idx, total: stack.length });
    });
  }

  // Max stack height determines chart height
  const maxStack = Math.max(...Object.values(stackMap).map((s) => s.length), 1);

  const DOT_PX = 12;
  const DOT_GAP = 2;
  const chartHeight = Math.max(32, (DOT_PX + DOT_GAP) * maxStack + 8);

  // Bracket band position
  const bracketLeftPct = Math.max(0, ((bracket.low - lineMin) / lineRange) * 100);
  const bracketRightPct = Math.min(100, ((bracket.high - lineMin) / lineRange) * 100);

  const colorClass = {
    green: "bg-emerald-500",
    red: "bg-red-400",
    gray: "bg-gray-300",
  };

  const borderClass = {
    green: "ring-emerald-600",
    red: "ring-red-500",
    gray: "ring-gray-400",
  };

  return (
    <div className="my-4 rounded-lg bg-gray-50/80 p-4">
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-wide text-gray-500">
          Rating Spread
        </p>
        <div className="flex items-center gap-2">
          {hasLive && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              Live
            </span>
          )}
          <span className="text-xs text-gray-400">
            {rated.length} rated
          </span>
        </div>
      </div>

      {/* Summary stats */}
      <p className="mb-2 text-xs text-gray-400">
        {rated.length} player{rated.length !== 1 ? "s" : ""}
        {" · "}avg {avg.toFixed(2)}
        {" · "}range {minRating.toFixed(1)}–{maxRating.toFixed(1)}
      </p>

      {/* Dot plot */}
      <div className="relative w-full select-none">
        {/* Dots area */}
        <div
          className="relative w-full"
          style={{ height: `${chartHeight}px` }}
        >
          {/* Bracket band */}
          <div
            className="absolute bottom-0 top-0 rounded bg-emerald-100/70"
            style={{
              left: `${bracketLeftPct}%`,
              width: `${bracketRightPct - bracketLeftPct}%`,
            }}
          />

          {/* Dots */}
          {dots.map((d, i) => {
            const player = d.player;
            const bottomPx = (d.col * (DOT_PX + DOT_GAP)) + 4;
            return (
              <div
                key={`${player.name}-${i}`}
                title={`${player.name} · ${player.rating.toFixed(2)}`}
                className={`absolute rounded-full ring-1 cursor-default transition-transform hover:scale-150 hover:z-10 ${colorClass[player.color]} ${borderClass[player.color]}`}
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
            const pct = ((t - lineMin) / lineRange) * 100;
            const isWhole = Number.isInteger(t);
            return (
              <div
                key={t}
                className="absolute flex flex-col items-center"
                style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
              >
                <div className={`${isWhole ? "h-2 w-px bg-gray-500" : "h-1.5 w-px bg-gray-300"}`} />
                {isWhole && (
                  <span className="mt-0.5 text-xs font-semibold text-gray-500">
                    {t.toFixed(1)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Bracket label */}
        <div
          className="absolute mt-1 flex justify-center"
          style={{
            left: `${bracketLeftPct}%`,
            width: `${bracketRightPct - bracketLeftPct}%`,
            top: `${chartHeight + 2}px`,
          }}
        >
          <span className="rounded bg-emerald-100 px-1 py-0.5 text-xs font-semibold text-emerald-700">
            bracket
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          In bracket
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          Above bracket
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-gray-300" />
          Below bracket
        </span>
      </div>
    </div>
  );
}
