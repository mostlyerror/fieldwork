import type { EventPlayer } from "@/lib/types";

interface Bucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

function buildBuckets(players: EventPlayer[]): Bucket[] {
  const rated = players.filter((p) => p.dupr_rating != null);
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
    const r = p.dupr_rating!;
    const bucket = buckets.find((b) => r >= b.min && r < b.max);
    if (bucket) bucket.count++;
  }

  return buckets.filter((b) => b.count > 0);
}

export function DuprDistribution({ players }: { players: EventPlayer[] }) {
  const buckets = buildBuckets(players);
  if (buckets.length === 0) return null;

  const maxCount = Math.max(...buckets.map((b) => b.count));

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        DUPR Distribution
      </p>
      <div className="space-y-0.5">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-2 text-xs">
            <span className="w-12 text-right font-medium text-gray-500">{b.label}</span>
            <div className="flex-1">
              <div
                className="h-4 rounded-full bg-emerald-500/80"
                style={{ width: `${(b.count / maxCount) * 100}%`, minWidth: "8px" }}
              />
            </div>
            <span className="w-5 text-right font-bold text-gray-600">{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
