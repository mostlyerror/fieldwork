"use client";

import type { TournamentEvent } from "@/lib/types";
import { ratingHistogram, eventIntel } from "@/lib/field-intel";

// Zone semantics — consistent across the app. Over-cap is the alarm color, and
// it attaches to the rating/bar (the data), never to a person.
const IN = "#1F9D57"; // in window
const BELOW = "#AEB6BC"; // below floor
const OVER = "#E0483B"; // over the cap
const TINT = "#ECFDF3"; // window shading
const AVG = "#053E2E"; // average marker
const EDGE = "#065F46"; // floor/cap labels
const AXIS = "#9AA59E";
const HAIR = "#D9D3C2";

const f2 = (n: number) => n.toFixed(2);
const floorHalf = (v: number) => Math.floor(v * 2) / 2;
const ceilHalf = (v: number) => Math.ceil(v * 2) / 2;

interface Bucket {
  key: number;
  count: number;
  zin: number;
  zbelow: number;
  zabove: number;
}

/**
 * Rating distribution — a plain, legible bar histogram of the field's effective
 * DUPR ratings against the bracket's skill window. Ratings are bucketed into
 * 0.25-wide bars so the shape reads in under two seconds; the window is shaded,
 * over-cap bars are red (with a count), and the true average is marked.
 */
export function DuprDistribution({ event }: { event: TournamentEvent }) {
  const histo = ratingHistogram(event);
  if (histo.total === 0 || histo.avg == null) return null;

  const intel = eventIntel(event);
  const skillMin = event.skill_level_min;
  const skillMax = event.skill_level_max;

  // ── geometry (viewBox units; scales to container width) ──
  const W = 358;
  const H = 150;
  const padL = 4;
  const padR = 4;
  const padTop = 18;
  const axisH = 26;
  const plotW = W - padL - padR;
  const plotH = H - padTop - axisH;

  // domain padded to the nearest 0.5 around the data and the window
  const ratings = histo.bins.map((b) => b.rating);
  const lo = floorHalf(Math.min(...ratings, skillMin ?? ratings[0]));
  let hi = ceilHalf(Math.max(...ratings, skillMax ?? ratings[ratings.length - 1]));
  if (hi - lo < 1) hi = lo + 1;
  const span = hi - lo;
  const x = (r: number) => padL + ((r - lo) / span) * plotW;

  // ── bucket the 0.1 bins into 0.25-wide bars ──
  const bw = 0.25;
  const map = new Map<number, Bucket>();
  for (const bin of histo.bins) {
    const key = Math.floor(bin.rating / bw) * bw;
    const cur = map.get(key) ?? { key, count: 0, zin: 0, zbelow: 0, zabove: 0 };
    cur.count += bin.count;
    if (bin.zone === "above") cur.zabove += bin.count;
    else if (bin.zone === "below") cur.zbelow += bin.count;
    else cur.zin += bin.count;
    map.set(key, cur);
  }
  const buckets = [...map.values()];
  const maxC = Math.max(1, ...buckets.map((d) => d.count));
  const barW = Math.max(3, (bw / span) * plotW - 3);

  const zoneColor = (d: Bucket) => {
    if (d.zabove > 0) return OVER;
    if (d.zbelow > 0 && d.zin === 0) return BELOW;
    return IN;
  };

  const hasWindow = skillMin != null || skillMax != null;
  const winLo = skillMin != null ? x(skillMin) : padL;
  const winHi = skillMax != null ? x(skillMax) : W - padR;

  // axis ticks every 0.5
  const ticks: number[] = [];
  for (let t = ceilHalf(lo); t <= hi + 1e-6; t = Math.round((t + 0.5) * 10) / 10) {
    ticks.push(t);
  }

  const avgX = x(histo.avg);
  const baseY = padTop + plotH;

  return (
    <div className="my-4 max-w-full rounded-xl bg-gray-50/80 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="t-label text-gray-500">Rating distribution</p>
        <span className="t-caption text-gray-400">{histo.total} rated</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={
          hasWindow
            ? `Rating distribution: ${intel.inRange} in the window, ${intel.below} below the floor, ${intel.above} over the cap. Average ${f2(histo.avg)}.`
            : `Rating distribution of ${histo.total} players, average ${f2(histo.avg)}. Open bracket with no rating limits.`
        }
      >
        {/* window shading */}
        {hasWindow && (
          <rect
            x={Math.max(padL, winLo)}
            y={padTop}
            width={Math.min(W - padR, winHi) - Math.max(padL, winLo)}
            height={plotH}
            fill={TINT}
          />
        )}
        {skillMin != null && (
          <line x1={winLo} y1={padTop} x2={winLo} y2={baseY} stroke={IN} strokeWidth={1} strokeDasharray="2 2" opacity={0.6} />
        )}
        {skillMax != null && (
          <line x1={winHi} y1={padTop} x2={winHi} y2={baseY} stroke={IN} strokeWidth={1} strokeDasharray="2 2" opacity={0.6} />
        )}

        {/* baseline */}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke={HAIR} strokeWidth={1.2} />

        {/* axis ticks */}
        {ticks.map((t) => {
          const edge =
            (skillMin != null && Math.abs(t - skillMin) < 1e-9) ||
            (skillMax != null && Math.abs(t - skillMax) < 1e-9);
          return (
            <g key={t}>
              <line x1={x(t)} y1={baseY} x2={x(t)} y2={baseY + 4} stroke={edge ? EDGE : HAIR} strokeWidth={1} />
              <text x={x(t)} y={baseY + 17} textAnchor="middle" fontSize={10} fontWeight={edge ? 700 : 600} fill={edge ? EDGE : AXIS} style={{ fontVariantNumeric: "tabular-nums" }}>
                {t.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* bars */}
        {buckets.map((d) => {
          const bx = x(d.key) + 1.5;
          const bh = Math.max(2, (d.count / maxC) * plotH);
          const by = baseY - bh;
          return (
            <g key={d.key}>
              <rect x={bx} y={by} width={barW} height={bh} rx={2.5} fill={zoneColor(d)} />
              {d.zabove > 0 && (
                <text x={bx + barW / 2} y={by - 4} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={OVER}>
                  {d.zabove}
                </text>
              )}
            </g>
          );
        })}

        {/* average marker */}
        <line x1={avgX} y1={padTop - 6} x2={avgX} y2={baseY} stroke={AVG} strokeWidth={1.6} strokeDasharray="3 3" />
        <g transform={`translate(${avgX}, ${padTop - 7})`}>
          <rect x={-22} y={-13} width={44} height={15} rx={4} fill={AVG} />
          <text x={0} y={-2} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="#fff" style={{ fontVariantNumeric: "tabular-nums" }}>
            avg {f2(histo.avg)}
          </text>
        </g>

        {/* floor / cap labels */}
        {skillMin != null && (
          <text x={winLo + 3} y={padTop + 10} fontSize={9} fontWeight={700} fill={EDGE}>
            floor {skillMin.toFixed(1)}
          </text>
        )}
        {skillMax != null && (
          <text x={winHi - 3} y={padTop + 10} textAnchor="end" fontSize={9} fontWeight={700} fill={EDGE}>
            cap {skillMax.toFixed(1)}
          </text>
        )}
      </svg>

      {/* legend doubles as the count summary */}
      {hasWindow ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 t-small font-semibold text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: IN }} />
            <b className="tabular-nums text-gray-900">{intel.inRange}</b> in window
          </span>
          {intel.above > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: OVER }} />
              <b className="tabular-nums text-gray-900">{intel.above}</b> over cap
            </span>
          )}
          {intel.below > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BELOW }} />
              <b className="tabular-nums text-gray-900">{intel.below}</b> below floor
            </span>
          )}
        </div>
      ) : (
        <p className="mt-3 t-small text-gray-400">
          Open bracket — no rating limits, so ratings aren&apos;t scored against a floor or cap.
        </p>
      )}
    </div>
  );
}
