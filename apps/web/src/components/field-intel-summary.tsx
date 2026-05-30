import type { TournamentEvent } from "@/lib/types";
import { fieldSummary } from "@/lib/field-intel";

function ArrowUp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

/**
 * Headline of the Field Intelligence panel. Leads with the live-vs-listed delta
 * (the sharpest read on a field), then a clean three-metric row.
 */
export function FieldIntelSummary({ events }: { events: TournamentEvent[] }) {
  const s = fieldSummary(events);
  if (s.listedAvg == null && s.liveAvg == null) return null;

  const maxSandbaggerPct = Math.max(
    0,
    ...events.map((e) => e.sandbagger_pct ?? 0),
  );
  const sandbaggerEvents = events.filter((e) => (e.sandbagger_pct ?? 0) > 0.2).length;

  const delta = s.delta;
  const up = delta != null && delta > 0;

  // Plain-language insight sentence.
  let insight: React.ReactNode;
  if (delta != null && Math.abs(delta) >= 0.05) {
    insight = (
      <>
        The field is playing{" "}
        <b className="font-extrabold text-emerald-800">
          {up ? "+" : ""}
          {delta.toFixed(2)} {up ? "above" : "below"}
        </b>{" "}
        what players listed at registration.
        {s.totalPeople > 0 && (
          <>
            {" "}
            {s.livePeople} of {s.totalPeople} entrants now have a live rating.
          </>
        )}
      </>
    );
  } else if (s.hasLiveData) {
    insight = (
      <>
        The field is playing right at its listed skill levels.
        {s.totalPeople > 0 && (
          <>
            {" "}
            {s.livePeople} of {s.totalPeople} entrants have a live rating.
          </>
        )}
      </>
    );
  } else {
    insight = (
      <>Ratings are self-reported at registration — live DUPR appears as players are matched.</>
    );
  }

  return (
    <div className="border-b border-gray-100 bg-white px-4 py-4 sm:px-5">
      {sandbaggerEvents > 0 && maxSandbaggerPct > 0.2 && (
        <p className="mb-3 text-sm font-semibold text-red-700">
          ⚠ {sandbaggerEvents} bracket{sandbaggerEvents !== 1 ? "s" : ""} with players rated above the skill cap
        </p>
      )}

      <p className="mb-4 text-sm font-medium leading-relaxed text-gray-600">{insight}</p>

      <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3.5">
        {/* Field avg (live) with delta + struck-through listed */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
            Field avg{s.hasLiveData ? " (live)" : ""}
          </span>
          <span className="flex items-baseline gap-1.5 text-2xl font-extrabold tabular-nums tracking-tight text-gray-900">
            {(s.liveAvg ?? s.listedAvg)?.toFixed(2)}
            {delta != null && Math.abs(delta) >= 0.05 && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-extrabold tabular-nums ${up ? "text-emerald-700" : "text-blue-600"}`}>
                <ArrowUp className={`h-2.5 w-2.5 ${up ? "" : "rotate-180"}`} />
                {Math.abs(delta).toFixed(2)}
              </span>
            )}
          </span>
          {s.hasLiveData && s.listedAvg != null && (
            <span className="text-xs font-medium text-gray-400 line-through">
              listed {s.listedAvg.toFixed(2)}
            </span>
          )}
        </div>

        {/* Registered */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Registered</span>
          <span className="text-2xl font-extrabold tabular-nums tracking-tight text-gray-900">
            {s.totalRegistered}
          </span>
        </div>
      </div>
    </div>
  );
}
