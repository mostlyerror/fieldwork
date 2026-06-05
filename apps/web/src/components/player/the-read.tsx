import type { TheReadProps } from "./types";
import { RadarMarkIcon } from "@/components/icons";

/**
 * "The Read" — the deterministic scouting paragraph rendered as the editorial
 * lede of the Scouting Report. Quietly authoritative: a small radar-marked
 * eyebrow over a comfortable-to-read paragraph, anchored by an emerald accent
 * rule. Presentational only — takes props, renders.
 */
export function TheRead({ read }: TheReadProps) {
  if (!read?.trim()) return null;

  return (
    <section className="rounded-2xl border border-gray-200/70 bg-emerald-50/40 p-5 shadow-card sm:rounded-3xl sm:p-7">
      <div className="flex items-center gap-2 text-emerald-700">
        <RadarMarkIcon className="h-4 w-4" />
        <span className="t-label uppercase tracking-wide">The Read</span>
      </div>

      <div className="mt-3 border-l-2 border-emerald-700/40 pl-4 sm:pl-5">
        <p className="t-body max-w-prose leading-relaxed text-gray-900 sm:text-lg sm:leading-relaxed">
          {read}
        </p>
      </div>
    </section>
  );
}
