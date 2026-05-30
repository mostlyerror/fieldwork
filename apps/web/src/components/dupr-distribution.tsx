"use client";

import type { TournamentEvent } from "@/lib/types";
import { ratingHistogram, eventIntel, type Zone } from "@/lib/field-intel";

const ZONE_FILL: Record<Zone, string> = {
  in: "#1f9d57",
  below: "#aeb6bc",
  above: "#e0483b",
};

// Windowless events (Beginner brackets, junior 10U–16U) have no DUPR floor/cap,
// so "in window / below / over" doesn't apply — squares render neutral.
const NEUTRAL = "#9aa6a0";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const floorHalf = (v: number) => Math.floor(v / 0.5) * 0.5;
const ceilHalf = (v: number) => Math.ceil(v / 0.5) * 0.5;

/**
 * Unit-square histogram of a bracket's DUPR ratings ("The Column").
 * Each square is one real player, stacked into 0.1 bins positioned by rating,
 * zone-colored against the bracket's skill window. Tall stacks (big fields) cap
 * at MAX_ROWS squares with a +N overflow marker so it never runs off the card.
 */
export function DuprDistribution({ event }: { event: TournamentEvent }) {
  const histo = ratingHistogram(event);
  if (histo.total === 0 || histo.avg == null) return null;

  const intel = eventIntel(event);
  const { skill_level_min: skillMin, skill_level_max: skillMax } = event;

  // Axis domain — pad to the nearest 0.5 around both the data and the window.
  const lo = Math.min(histo.min!, skillMin ?? histo.min!);
  const hi = Math.max(histo.max!, skillMax ?? histo.max!);
  const axisMin = floorHalf(lo - 0.1);
  const axisMax = ceilHalf(hi + 0.1);
  const span = Math.max(0.5, axisMax - axisMin);

  // Geometry (viewBox units; the SVG scales to container width).
  const W = 356;
  const padL = 8;
  const padR = 8;
  const plotW = W - padL - padR;
  const numSlots = Math.max(1, Math.round(span / 0.1));
  const slot = plotW / numSlots;
  const sq = clamp(slot - 2, 5, 13);
  const gap = Math.max(2, Math.round(sq * 0.18));

  const MAX_ROWS = 9;
  const shownMax = Math.min(histo.maxStack, MAX_ROWS);
  const topPad = 42; // room for the stacked avg + window labels above the band
  const columnsH = shownMax * sq + (shownMax - 1) * gap;
  const baseY = topPad + columnsH;
  const H = baseY + 24;

  const xOf = (r: number) => padL + ((r - axisMin) / span) * plotW;
  const bandTop = topPad - 6;

  const ticks: number[] = [];
  for (let t = axisMin; t <= axisMax + 1e-9; t = Math.round((t + 0.5) * 10) / 10) ticks.push(t);

  const avgX = xOf(histo.avg);
  const hasBand = skillMin != null && skillMax != null; // both bounds → draw the band rect
  const hasWindow = skillMin != null || skillMax != null; // any bound → zones are meaningful
  const winX1 = hasBand ? Math.max(padL, xOf(skillMin!) - slot / 2) : 0;
  const winX2 = hasBand ? Math.min(W - padR, xOf(skillMax!) + slot / 2) : 0;

  return (
    <div className="my-4 max-w-full rounded-xl bg-gray-50/80 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Rating spread</p>
        <span className="text-xs text-gray-400">{histo.total} rated</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full" style={{ maxWidth: 420 }} role="img" aria-label={hasWindow ? `Rating distribution: ${intel.inRange} in the window, ${intel.below} below the floor, ${intel.above} above the cap.` : `Rating distribution of ${histo.total} players. Open bracket with no rating limits.`}>
        {/* bracket window band */}
        {hasBand && (
          <>
            <rect x={winX1} y={bandTop} width={winX2 - winX1} height={baseY - bandTop} rx={9} fill="rgba(31,157,87,0.07)" stroke="rgba(6,95,70,0.26)" strokeWidth={1} strokeDasharray="2 4" />
            <text x={(winX1 + winX2) / 2} y={bandTop - 8} textAnchor="middle" fontSize={9} fontWeight={700} letterSpacing="0.1em" fill="#065f46">
              {skillMin === skillMax ? `BRACKET ${skillMin!.toFixed(1)}` : `BRACKET ${skillMin!.toFixed(1)}–${skillMax!.toFixed(1)}`}
            </text>
          </>
        )}

        {/* average reference */}
        <line x1={avgX} y1={bandTop + 2} x2={avgX} y2={baseY} stroke="#16201b" strokeWidth={1} strokeDasharray="1.5 3" opacity={0.5} />
        <circle cx={avgX} cy={bandTop + 2} r={2} fill="#16201b" opacity={0.65} />
        <text x={avgX} y={bandTop - 22} textAnchor="middle" fontSize={10} fontWeight={700} fill="#16201b">{`avg ${histo.avg.toFixed(2)}`}</text>

        {/* baseline */}
        <line x1={padL} y1={baseY + 0.5} x2={W - padR} y2={baseY + 0.5} stroke="#d9d8cf" strokeWidth={1} />

        {/* stacked unit squares */}
        {histo.bins.map((bin) => {
          const cx = xOf(bin.rating);
          const rows = Math.min(bin.count, MAX_ROWS);
          const overflow = bin.count - rows;
          return (
            <g key={bin.rating}>
              {Array.from({ length: rows }).map((_, i) => (
                <rect
                  key={i}
                  x={cx - sq / 2}
                  y={baseY - sq - i * (sq + gap)}
                  width={sq}
                  height={sq}
                  rx={Math.max(2, sq * 0.25)}
                  fill={hasWindow ? ZONE_FILL[bin.zone] : NEUTRAL}
                  opacity={hasWindow && bin.zone === "above" ? 0.92 : 1}
                />
              ))}
              {overflow > 0 && (
                <text x={cx} y={baseY - rows * (sq + gap) - 1} textAnchor="middle" fontSize={9} fontWeight={800} fill="#5c6661">{`+${overflow}`}</text>
              )}
            </g>
          );
        })}

        {/* axis ticks every 0.5 */}
        {ticks.map((t) => {
          const edge = (skillMin != null && Math.abs(t - skillMin) < 1e-9) || (skillMax != null && Math.abs(t - skillMax) < 1e-9);
          return (
            <g key={t}>
              <line x1={xOf(t)} y1={baseY + 1} x2={xOf(t)} y2={baseY + 5} stroke={edge ? "#065f46" : "#c7c6bc"} strokeWidth={1} />
              <text x={xOf(t)} y={baseY + 17} textAnchor="middle" fontSize={10.5} fontWeight={edge ? 700 : 600} fill={edge ? "#065f46" : "#97a09a"}>{t.toFixed(1)}</text>
            </g>
          );
        })}
      </svg>

      {/* merged zone legend: color + count + label (only when a window exists) */}
      {hasWindow ? (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[13px] font-semibold text-gray-600">
          <span className="inline-flex items-baseline gap-1.5">
            <span className="h-2.5 w-2.5 translate-y-0.5 rounded-[3px]" style={{ background: ZONE_FILL.in }} />
            <b className="text-[17px] font-extrabold tracking-tight text-emerald-700">{intel.inRange}</b> in window
          </span>
          {intel.below > 0 && (
            <span className="inline-flex items-baseline gap-1.5">
              <span className="h-2.5 w-2.5 translate-y-0.5 rounded-[3px]" style={{ background: ZONE_FILL.below }} />
              <b className="text-[17px] font-extrabold tracking-tight text-gray-500">{intel.below}</b> below floor
            </span>
          )}
          {intel.above > 0 && (
            <span className="inline-flex items-baseline gap-1.5">
              <span className="h-2.5 w-2.5 translate-y-0.5 rounded-[3px]" style={{ background: ZONE_FILL.above }} />
              <b className="text-[17px] font-extrabold tracking-tight text-red-600">{intel.above}</b> over cap
            </span>
          )}
        </div>
      ) : (
        <p className="mt-4 text-[13px] font-medium text-gray-400">
          Open bracket — no rating limits, so ratings aren&apos;t scored against a floor or cap.
        </p>
      )}
    </div>
  );
}
