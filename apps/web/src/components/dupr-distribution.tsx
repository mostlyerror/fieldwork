import type { EventPlayer } from "@/lib/types";

interface Bucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

const BUCKET_COLORS = [
  { bar: "from-emerald-400 to-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  { bar: "from-teal-400 to-teal-500", bg: "bg-teal-50", text: "text-teal-700" },
  { bar: "from-cyan-400 to-cyan-500", bg: "bg-cyan-50", text: "text-cyan-700" },
  { bar: "from-blue-400 to-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
  { bar: "from-indigo-400 to-indigo-500", bg: "bg-indigo-50", text: "text-indigo-700" },
  { bar: "from-violet-400 to-violet-500", bg: "bg-violet-50", text: "text-violet-700" },
  { bar: "from-purple-400 to-purple-500", bg: "bg-purple-50", text: "text-purple-700" },
];

function buildBuckets(players: EventPlayer[]): Bucket[] {
  const rated = players.filter((p) => (p.live_dupr ?? p.dupr_rating) != null);
  if (rated.length === 0) return [];

  const buckets: Bucket[] = [
    { label: "2.0–2.5", min: 0, max: 2.5, count: 0 },
    { label: "2.5–3.0", min: 2.5, max: 3.0, count: 0 },
    { label: "3.0–3.5", min: 3.0, max: 3.5, count: 0 },
    { label: "3.5–4.0", min: 3.5, max: 4.0, count: 0 },
    { label: "4.0–4.5", min: 4.0, max: 4.5, count: 0 },
    { label: "4.5–5.0", min: 4.5, max: 5.0, count: 0 },
    { label: "5.0+", min: 5.0, max: 99, count: 0 },
  ];

  for (const p of rated) {
    const r = (p.live_dupr ?? p.dupr_rating)!;
    const bucket = buckets.find((b) => r >= b.min && r < b.max);
    if (bucket) bucket.count++;
  }

  return buckets.filter((b) => b.count > 0);
}

export function DuprDistribution({ players }: { players: EventPlayer[] }) {
  const buckets = buildBuckets(players);
  if (buckets.length === 0) return null;

  const maxCount = Math.max(...buckets.map((b) => b.count));
  const totalRated = buckets.reduce((s, b) => s + b.count, 0);
  const hasLive = players.some((p) => p.live_dupr != null);

  // Find peak bucket
  const peakIdx = buckets.findIndex((b) => b.count === maxCount);

  return (
    <div className="my-3 rounded-lg bg-gray-50/80 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Rating Spread
        </p>
        <div className="flex items-center gap-2">
          {hasLive && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              Live
            </span>
          )}
          <span className="text-[10px] text-gray-400">
            {totalRated} rated
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        {buckets.map((b, i) => {
          const pct = (b.count / maxCount) * 100;
          const colorIdx = Math.min(
            Math.floor((b.min - 2) / 0.5),
            BUCKET_COLORS.length - 1
          );
          const color = BUCKET_COLORS[Math.max(0, colorIdx)];
          const isPeak = i === peakIdx;

          return (
            <div key={b.label} className="flex items-center gap-2">
              <span className={`w-14 text-right text-xs font-semibold ${isPeak ? "text-gray-900" : "text-gray-400"}`}>
                {b.label}
              </span>
              <div className="relative flex-1">
                <div className="h-5 w-full rounded bg-gray-100/80" />
                <div
                  className={`absolute inset-y-0 left-0 rounded bg-gradient-to-r ${color.bar} transition-all duration-500`}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </div>
              <span className={`w-8 text-right text-xs font-bold ${isPeak ? "text-gray-900" : "text-gray-500"}`}>
                {b.count}
              </span>
              <span className="w-8 text-right text-[10px] text-gray-400">
                {Math.round((b.count / totalRated) * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
