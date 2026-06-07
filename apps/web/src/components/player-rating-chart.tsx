"use client";

import { useState } from "react";
import type { RatingTrendProps } from "@/components/player/types";

const f2 = (n: number) => n.toFixed(2);
const f3 = (n: number) => n.toFixed(3);
const signed3 = (n: number) => `${n >= 0 ? "+" : ""}${f3(n)}`;
const shortDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
const fullDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const dayMs = (s: string) => +new Date(s + "T00:00:00");

/** Evenly downsample to at most `max` points, always keeping first + last. */
function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const out: T[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  // Guard against rounding collisions dropping the true last point.
  if (out[out.length - 1] !== points[points.length - 1]) {
    out[out.length - 1] = points[points.length - 1];
  }
  return out;
}

/**
 * Monotone-cubic (Fritsch–Carlson) tangents → smooth SVG path that never
 * overshoots the data. Returns an "M … C …" path string through (xs[i],ys[i]).
 */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n < 2) return "";
  if (n === 2) return `M${xs[0]},${ys[0]} L${xs[1]},${ys[1]}`;

  const dx: number[] = [];
  const dy: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i];
    dy[i] = ys[i + 1] - ys[i];
    slope[i] = dx[i] === 0 ? 0 : dy[i] / dx[i];
  }

  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (slope[i - 1] + slope[i]) / 2;
    }
  }
  // Enforce monotonicity (prevent overshoot).
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / slope[i];
      const b = m[i + 1] / slope[i];
      const h = Math.hypot(a, b);
      if (h > 3) {
        const t = 3 / h;
        m[i] = t * a * slope[i];
        m[i + 1] = t * b * slope[i];
      }
    }
  }

  let d = `M${xs[0].toFixed(2)},${ys[0].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = xs[i] + dx[i] / 3;
    const c1y = ys[i] + (m[i] * dx[i]) / 3;
    const c2x = xs[i + 1] - dx[i] / 3;
    const c2y = ys[i + 1] - (m[i + 1] * dx[i]) / 3;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${xs[i + 1].toFixed(2)},${ys[i + 1].toFixed(2)}`;
  }
  return d;
}

/**
 * A player's DUPR doubles rating over time — a smooth (monotone-cubic) SVG
 * area+line chart in the warm design language. Renders nothing under 2 points.
 */
export function PlayerRatingChart({
  points,
  current,
  delta,
  peak,
  low,
  trendLabel,
  events = [],
}: RatingTrendProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const data = downsample(points, 44);
  if (data.length < 2) return null;

  const ratings = data.map((p) => p.rating);
  const seriesMin = Math.min(...ratings);
  const seriesMax = Math.max(...ratings);
  const latest = current ?? ratings[ratings.length - 1];
  const first = ratings[0];
  const change = delta ?? latest - first;
  const peakVal = peak ?? seriesMax;
  const lowVal = low ?? seriesMin;
  const up = change >= 0;

  // Extra readouts: full range and "swing" (avg absolute move between matches).
  const range = peakVal - lowVal;
  const vol =
    points.length > 1
      ? points.slice(1).reduce((s, p, i) => s + Math.abs(p.rating - points[i].rating), 0) /
        (points.length - 1)
      : 0;

  // geometry (viewBox units; scales to container width)
  const W = 600;
  const H = 184;
  const padL = 6;
  const padR = 6;
  const padT = 14;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const baseY = padT + plotH;

  const ylo = seriesMin - 0.08;
  const yhi = seriesMax + 0.08;
  const span = Math.max(0.12, yhi - ylo);
  const x = (i: number) =>
    padL + (data.length === 1 ? 0 : (i / (data.length - 1)) * plotW);
  const y = (r: number) => padT + (1 - (r - ylo) / span) * plotH;

  const xs = data.map((_, i) => x(i));
  const ys = data.map((p) => y(p.rating));
  const line = monotonePath(xs, ys);
  const area = `${line} L${xs[xs.length - 1].toFixed(2)},${baseY.toFixed(2)} L${xs[0].toFixed(2)},${baseY.toFixed(2)} Z`;

  // Peak / low marker positions (first index hitting the series extreme).
  const peakIdx = ratings.indexOf(seriesMax);
  const lowIdx = ratings.indexOf(seriesMin);
  const lastIdx = data.length - 1;

  // Tournament markers — snap each event to the nearest rating point by date
  // (the x-axis is index-spaced, so we reuse xs/ys), within range, deduped to
  // one marker per point. delta = the rating move into that point.
  const dataTimes = data.map((d) => dayMs(d.date));
  const markerMap = new Map<number, string[]>();
  for (const e of events) {
    const t = dayMs(e.date);
    if (t < dataTimes[0] || t > dataTimes[lastIdx]) continue;
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < dataTimes.length; i++) {
      const diff = Math.abs(dataTimes[i] - t);
      if (diff < best) { best = diff; idx = i; }
    }
    if (idx <= 0) continue; // need a prior point to compute a delta
    if (!markerMap.has(idx)) markerMap.set(idx, []);
    markerMap.get(idx)!.push(e.label);
  }
  const markers = Array.from(markerMap.entries())
    .map(([idx, labels]) => ({
      idx,
      x: xs[idx],
      y: ys[idx],
      delta: ratings[idx] - ratings[idx - 1],
      labels,
      date: data[idx].date,
    }))
    .sort((a, b) => a.idx - b.idx);
  const active = markers.find((m) => m.idx === activeIdx) ?? null;

  // Crosshair scrub: map a pointer x to the nearest rating point.
  const onScrub = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const frac = (px - padL) / plotW;
    setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round(frac * (data.length - 1)))));
  };

  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-card sm:rounded-3xl sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="t-label text-gray-400">Doubles rating trend</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="t-h1 tabular-nums text-emerald-800">{f3(latest)}</span>
            <span
              className={`t-small font-bold tabular-nums ${up ? "text-emerald-600" : "text-red-500"}`}
            >
              {signed3(change)}
            </span>
          </div>
          <div className="mt-0.5 t-caption text-gray-400">{trendLabel}</div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-0.5 text-right t-caption text-gray-400">
          <div>peak <b className="tabular-nums text-gray-700">{f2(peakVal)}</b></div>
          <div>range <b className="tabular-nums text-gray-700">{f2(range)}</b></div>
          <div>low <b className="tabular-nums text-gray-700">{f2(lowVal)}</b></div>
          <div>swing <b className="tabular-nums text-gray-700">±{f2(vol)}</b></div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 block h-auto w-full"
        role="img"
        aria-label={`Doubles rating trend: ${f3(first)} to ${f3(latest)} over ${points.length} matches. ${trendLabel}.`}
        onPointerMove={onScrub}
        onPointerDown={onScrub}
        onPointerLeave={() => setHoverIdx(null)}
        style={{ touchAction: "pan-y" }}
      >
        <defs>
          <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1f9d57" stopOpacity="0.18" />
            <stop offset="1" stopColor="#1f9d57" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#EAEDE9" strokeWidth={1} />

        {/* area + smooth line */}
        <path d={area} fill="url(#ratingFill)" />
        <path
          d={line}
          fill="none"
          stroke="#1f9d57"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* peak / low markers (skip when they coincide with the latest point) */}
        {peakIdx !== lastIdx && (
          <circle cx={xs[peakIdx]} cy={ys[peakIdx]} r={2.6} fill="#1f9d57" fillOpacity={0.55} />
        )}
        {lowIdx !== lastIdx && lowIdx !== peakIdx && (
          <circle cx={xs[lowIdx]} cy={ys[lowIdx]} r={2.6} fill="#9AA59E" />
        )}

        {/* tournament markers — snapped to the nearest rating point */}
        {markers.map((mk) => {
          const isActive = mk.idx === activeIdx;
          return (
            <g
              key={mk.idx}
              style={{ cursor: "pointer" }}
              onClick={() => setActiveIdx(isActive ? null : mk.idx)}
            >
              {isActive && (
                <line x1={mk.x} y1={mk.y} x2={mk.x} y2={baseY} stroke="#E0A93B" strokeWidth={1} strokeDasharray="2 2" />
              )}
              <circle
                cx={mk.x}
                cy={mk.y}
                r={isActive ? 4.5 : 3.2}
                fill={isActive ? "#B7791F" : "#E0A93B"}
                stroke="#fff"
                strokeWidth={1.4}
              />
              {/* generous transparent hit target for tap */}
              <circle cx={mk.x} cy={mk.y} r={11} fill="transparent" />
              <title>{mk.labels.join(", ")}</title>
            </g>
          );
        })}

        {/* latest point */}
        <circle cx={xs[lastIdx]} cy={ys[lastIdx]} r={4} fill="#065F46" />
        <circle
          cx={xs[lastIdx]}
          cy={ys[lastIdx]}
          r={8}
          fill="none"
          stroke="#065F46"
          strokeOpacity={0.3}
          strokeWidth={1.4}
        />

        {/* crosshair scrub — follows the pointer along the line */}
        {hoverIdx != null && hoverIdx !== lastIdx && (
          <g pointerEvents="none">
            <line x1={xs[hoverIdx]} y1={padT} x2={xs[hoverIdx]} y2={baseY} stroke="#1f9d57" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={xs[hoverIdx]} cy={ys[hoverIdx]} r={4} fill="#fff" stroke="#065F46" strokeWidth={2} />
            {(() => {
              const bw = 86, bh = 32;
              const bx = Math.max(padL, Math.min(W - padR - bw, xs[hoverIdx] - bw / 2));
              const by = Math.max(2, ys[hoverIdx] - bh - 9);
              return (
                <g transform={`translate(${bx},${by})`}>
                  <rect width={bw} height={bh} rx={7} fill="#0b1f17" />
                  <text x={bw / 2} y={14} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff" style={{ fontVariantNumeric: "tabular-nums" }}>{f3(ratings[hoverIdx])}</text>
                  <text x={bw / 2} y={26} textAnchor="middle" fontSize={9} fontWeight={600} fill="#9af5c8">{fullDate(data[hoverIdx].date)}</text>
                </g>
              );
            })()}
          </g>
        )}

        {/* y labels */}
        <text x={padL} y={y(seriesMax) - 5} fontSize={10.5} fontWeight={600} fill="#9AA59E" style={{ fontVariantNumeric: "tabular-nums" }}>
          {f2(seriesMax)}
        </text>
        <text x={padL} y={y(seriesMin) + 13} fontSize={10.5} fontWeight={600} fill="#9AA59E" style={{ fontVariantNumeric: "tabular-nums" }}>
          {f2(seriesMin)}
        </text>

        {/* x date labels */}
        <text x={padL} y={H - 7} fontSize={10.5} fontWeight={600} fill="#9AA59E">
          {shortDate(data[0].date)}
        </text>
        <text x={W - padR} y={H - 7} textAnchor="end" fontSize={10.5} fontWeight={600} fill="#9AA59E">
          {shortDate(data[data.length - 1].date)}
        </text>
      </svg>

      {/* tournament marker caption — reserved height so the chart doesn't jump */}
      {markers.length > 0 && (
        <div className="mt-2 flex min-h-[20px] items-center gap-2 t-caption">
          {active ? (
            <>
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
              <span className="min-w-0 truncate font-semibold text-gray-700">
                {active.labels[0]}
                {active.labels.length > 1 ? ` +${active.labels.length - 1} more` : ""}
              </span>
              <span className="shrink-0 text-gray-400">{fullDate(active.date)}</span>
              <span className={`shrink-0 font-bold tabular-nums ${active.delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {signed3(active.delta)}
              </span>
            </>
          ) : (
            <span className="text-gray-400">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" aria-hidden />
              Drag across the line to scrub · tap a marker for the tournament
            </span>
          )}
        </div>
      )}
    </div>
  );
}
