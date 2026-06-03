import type { TournamentEvent } from "@/lib/types";
import { eventIntel, ratingHistogram } from "@/lib/field-intel";

const f2 = (n: number) => n.toFixed(2);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The honesty line — how the field's true (live-DUPR) average compares to what
 * players self-reported at signup, plus a count of any ratings over the cap.
 * Attribution is to the ratings, never to individuals. Renders nothing when
 * there isn't a verified-vs-listed comparison to make.
 */
export function FieldHonesty({ event }: { event: TournamentEvent }) {
  const intel = eventIntel(event);
  // Use the SAME average the histogram plots (the field's effective best-known
  // rating) so the chart marker and this sentence always agree.
  const trueAvg = ratingHistogram(event).avg;
  const listed = intel.listedAvg;
  if (trueAvg == null || listed == null) return null;

  const delta = round2(trueAvg - listed);
  const gap = Math.abs(delta);
  const dir = delta >= 0 ? "above" : "below";
  const over = intel.above;
  const warn = over > 0 || gap >= 0.18;

  const tone = warn
    ? "border-red-200 bg-red-50 text-red-800"
    : "border-emerald-200 bg-emerald-50/70 text-emerald-900";

  const Icon = warn ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-[18px] w-[18px] flex-shrink-0">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-[18px] w-[18px] flex-shrink-0">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 t-small ${tone}`}>
      {Icon}
      <p className="leading-relaxed">
        {gap < 0.05 ? (
          <>
            Field is playing <b>true to its self-reported level</b> — true avg{" "}
            <b className="tabular-nums">{f2(trueAvg)}</b>.
          </>
        ) : (
          <>
            Field is playing <b className="tabular-nums">{f2(gap)}</b> {dir} its
            self-reported level — true avg{" "}
            <b className="tabular-nums">{f2(trueAvg)}</b> vs listed{" "}
            <span className="tabular-nums">{f2(listed)}</span>.
          </>
        )}
        {over > 0 && (
          <>
            {" "}
            <b>
              {over} rating{over > 1 ? "s" : ""} over the cap
            </b>
            .
          </>
        )}
      </p>
    </div>
  );
}
