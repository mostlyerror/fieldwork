import { MedalIcon } from "@/components/icons";
import type { RecordModuleProps } from "./types";

/** Win percentage as a rounded integer (0 when no matches played). */
function winPct(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return Math.round((wins / total) * 100);
}

type Split = {
  label: string;
  wins: number;
  losses: number;
};

/**
 * A single hairline-divided cell in the record fact row: W–L on top,
 * win% caption, and a thin emerald progress bar tracking the win rate.
 */
function RecordCell({ label, wins, losses }: Split) {
  const total = wins + losses;
  const pct = winPct(wins, losses);
  const empty = total === 0;

  return (
    <div className="min-w-0 px-2.5 first:pl-0 last:pr-0">
      <div className="t-label text-gray-400">{label}</div>
      <div className="mt-1 t-h3 tabular-nums text-gray-900">
        {empty ? (
          <span className="text-gray-300">--</span>
        ) : (
          <>
            {wins}
            <span className="text-gray-400">W</span>
            <span className="text-gray-300">–</span>
            {losses}
            <span className="text-gray-400">L</span>
          </>
        )}
      </div>
      <div className="mt-0.5 t-caption tabular-nums text-gray-500">
        {empty ? "No matches" : `${pct}% win rate`}
      </div>
      {/* Win-rate track — thin emerald sweep under each split */}
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100"
        role="presentation"
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-500"
          style={{ width: `${empty ? 0 : pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * RECORD — overall + format splits unified into one editorial fact row.
 * Overall is the sum of the splits, so it leads the row rather than living
 * in a separate card. Mobile-first, hairline-divided, tabular stats.
 */
export function RecordModule({ overall, doubles, singles }: RecordModuleProps) {
  return (
    <section className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-card sm:rounded-3xl sm:p-6">
      <div className="flex items-center gap-2">
        <MedalIcon className="h-4 w-4 text-emerald-700" />
        <h2 className="t-label text-gray-500">Record</h2>
      </div>

      <div className="mt-4 grid grid-cols-3 divide-x divide-gray-100">
        <RecordCell label="Overall" wins={overall.wins} losses={overall.losses} />
        <RecordCell label="Doubles" wins={doubles.wins} losses={doubles.losses} />
        <RecordCell label="Singles" wins={singles.wins} losses={singles.losses} />
      </div>
    </section>
  );
}
