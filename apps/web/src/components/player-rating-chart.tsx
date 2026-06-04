import type { RatingPoint } from "@/lib/queries";

const f2 = (n: number) => n.toFixed(2);
const f3 = (n: number) => n.toFixed(3);
const shortDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });

/**
 * A player's DUPR doubles rating over time — an SVG line/area chart in the
 * design language. Renders nothing with fewer than 2 points.
 */
export function PlayerRatingChart({ points }: { points: RatingPoint[] }) {
  if (points.length < 2) return null;

  const ratings = points.map((p) => p.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const latest = ratings[ratings.length - 1];
  const first = ratings[0];
  const change = latest - first;
  const up = change >= 0;

  // geometry (viewBox units; scales to container width)
  const W = 600;
  const H = 184;
  const padL = 6;
  const padR = 6;
  const padT = 14;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const ylo = min - 0.08;
  const yhi = max + 0.08;
  const span = Math.max(0.12, yhi - ylo);
  const x = (i: number) => padL + (points.length === 1 ? 0 : (i / (points.length - 1)) * plotW);
  const y = (r: number) => padT + (1 - (r - ylo) / span) * plotH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
  const baseY = padT + plotH;

  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-card sm:rounded-3xl sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="t-label text-gray-400">Doubles rating trend</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="t-h1 tabular-nums text-emerald-800">{f3(latest)}</span>
            <span className={`t-small font-bold tabular-nums ${up ? "text-emerald-600" : "text-red-500"}`}>
              {up ? "+" : ""}{f3(change)}
            </span>
          </div>
          <div className="mt-0.5 t-caption text-gray-400">over {points.length} rated matches</div>
        </div>
        <div className="shrink-0 text-right t-caption text-gray-400">
          <div>peak <b className="tabular-nums text-gray-700">{f2(max)}</b></div>
          <div className="mt-0.5">low <b className="tabular-nums text-gray-700">{f2(min)}</b></div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full" role="img" aria-label={`Doubles rating trend: ${f3(first)} to ${f3(latest)} over ${points.length} matches.`}>
        <defs>
          <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1f9d57" stopOpacity="0.18" />
            <stop offset="1" stopColor="#1f9d57" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#EAEDE9" strokeWidth={1} />

        {/* area + line */}
        <path d={area} fill="url(#ratingFill)" />
        <path d={line} fill="none" stroke="#1f9d57" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />

        {/* latest point */}
        <circle cx={x(points.length - 1)} cy={y(latest)} r={4} fill="#065F46" />
        <circle cx={x(points.length - 1)} cy={y(latest)} r={8} fill="none" stroke="#065F46" strokeOpacity={0.3} strokeWidth={1.4} />

        {/* y labels */}
        <text x={padL} y={y(max) - 5} fontSize={10.5} fontWeight={600} fill="#9AA59E" style={{ fontVariantNumeric: "tabular-nums" }}>{f2(max)}</text>
        <text x={padL} y={y(min) + 13} fontSize={10.5} fontWeight={600} fill="#9AA59E" style={{ fontVariantNumeric: "tabular-nums" }}>{f2(min)}</text>

        {/* x date labels */}
        <text x={padL} y={H - 7} fontSize={10.5} fontWeight={600} fill="#9AA59E">{shortDate(points[0].date)}</text>
        <text x={W - padR} y={H - 7} textAnchor="end" fontSize={10.5} fontWeight={600} fill="#9AA59E">{shortDate(points[points.length - 1].date)}</text>
      </svg>
    </div>
  );
}
