import Link from "next/link";
import { IntelSectionHeader } from "@/components/intel-section-header";
import type { HeadToHeadProps, OpponentRow } from "@/components/player/types";

/** Two-letter initials for the avatar circle. */
function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Verdict tone — emerald when the subject player is ahead in the matchup, red
 * when behind (incl. "Nemesis"), neutral when even. Factual results only; no
 * derogatory labels about the opponent (consent floor).
 */
function verdictTone(verdict: string): { className: string; dot: string } {
  const v = verdict.toLowerCase();
  if (v.includes("owns")) {
    return { className: "bg-emerald-700 text-white", dot: "bg-white/80" };
  }
  if (v.includes("leads")) {
    return { className: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" };
  }
  if (v.includes("nemesis") || v.includes("trails")) {
    return { className: "bg-red-50 text-red-600", dot: "bg-red-400" };
  }
  // Even
  return { className: "bg-amber-50 text-amber-700", dot: "bg-amber-400" };
}

function VerdictChip({ verdict }: { verdict: string }) {
  const tone = verdictTone(verdict);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 t-label tracking-[0.04em] ${tone.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
      {verdict}
    </span>
  );
}

function OpponentRowItem({ opponent }: { opponent: OpponentRow }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 t-caption font-bold text-gray-500"
        aria-hidden
      >
        {initials(opponent.name)}
      </div>

      <div className="min-w-0 flex-1">
        {opponent.playerId ? (
          <Link
            href={`/players/${opponent.playerId}`}
            className="block truncate t-body font-semibold text-gray-900 hover:text-emerald-700"
          >
            {opponent.name}
          </Link>
        ) : (
          <span className="block truncate t-body font-semibold text-gray-900">
            {opponent.name}
          </span>
        )}
        <div className="mt-1 flex items-center gap-2">
          <VerdictChip verdict={opponent.verdict} />
        </div>
      </div>

      {/* Record — from the subject player's perspective */}
      <div className="shrink-0 text-right">
        <div className="t-body font-semibold tabular-nums text-gray-900">
          {opponent.wins}
          <span className="text-gray-300">–</span>
          {opponent.losses}
        </div>
        <div className="mt-0.5 t-caption tabular-nums text-gray-400">
          {opponent.matches} meeting{opponent.matches !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

export function HeadToHead({ opponents }: HeadToHeadProps) {
  if (opponents.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/70 shadow-card sm:rounded-3xl">
      <IntelSectionHeader title="Head-to-Head" />
      <div className="divide-y divide-gray-100 bg-white">
        {opponents.map((o) => (
          <OpponentRowItem key={o.playerId ?? o.name} opponent={o} />
        ))}
      </div>
    </section>
  );
}
