"use client";

/**
 * <AttentionBanner> — THE "nothing fails silently" primitive.
 *
 * A full-width banner tinted to the worst current state (green = all good,
 * amber = act soon, red = act now) with a row of clickable "problem chips"
 * that deep-link to wherever the operator fixes the issue.
 *
 * Pass an explicit `state`, or omit it and let the banner derive the worst
 * state from its chips. When everything is healthy it renders a calm green
 * "all clear" bar (pass `hideWhenHealthy` to render nothing instead).
 *
 * Client component because chips can carry onClick handlers.
 */

import Link from "next/link";
import { ADMIN_STATUS, worstStatus, type AdminStatus } from "@/lib/admin-status";

export interface ProblemChip {
  label: React.ReactNode;
  /** Severity of this individual problem — drives chip tint + derived banner state. */
  level?: AdminStatus;
  /** Deep-link to the fix. Rendered as a Link when set. */
  href?: string;
  /** Click handler (mutually exclusive with href, takes precedence as a button). */
  onClick?: () => void;
}

export function AttentionBanner({
  state,
  title,
  chips = [],
  action,
  hideWhenHealthy = false,
  className = "",
}: {
  /** Worst state. If omitted, derived from the chips' levels. */
  state?: AdminStatus;
  /** Headline, e.g. "3 things need you before they rot". */
  title: React.ReactNode;
  chips?: ProblemChip[];
  /** Optional primary action on the right (e.g. "Run scraper now"). */
  action?: React.ReactNode;
  /** When derived/given state is healthy, render nothing. */
  hideWhenHealthy?: boolean;
  className?: string;
}) {
  const derived =
    state ??
    worstStatus(...chips.map((c) => c.level ?? "attention"));

  if (derived === "healthy" && hideWhenHealthy) return null;

  const tokens = ADMIN_STATUS[derived];
  const kicker =
    derived === "critical"
      ? "System status · action needed"
      : derived === "attention"
        ? "System status · needs attention"
        : "System status · all clear";

  return (
    <section
      className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5 ${tokens.bg} ${tokens.border} ${className}`}
    >
      <div className="flex flex-1 items-start gap-3.5">
        <span
          aria-hidden="true"
          className={`mt-1 h-3.5 w-3.5 flex-none rounded-full ${tokens.dot} ${derived !== "healthy" ? "animate-pulse" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <div
            className={`text-[10px] font-extrabold uppercase tracking-[0.12em] ${tokens.text}`}
          >
            {kicker}
          </div>
          <h2 className="mt-0.5 text-lg font-extrabold tracking-tight text-emerald-950">
            {title}
          </h2>
          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {chips.map((chip, i) => (
                <ProblemChipView key={i} chip={chip} />
              ))}
            </div>
          )}
        </div>
      </div>
      {action && <div className="flex-none">{action}</div>}
    </section>
  );
}

function ProblemChipView({ chip }: { chip: ProblemChip }) {
  const level = chip.level ?? "attention";
  const tokens = ADMIN_STATUS[level];
  const cls = `inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900 transition hover:border-emerald-900/20 ${tokens.border}`;
  const inner = (
    <>
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${tokens.dot}`}
      />
      <span>{chip.label}</span>
      <span aria-hidden="true" className="text-emerald-900/30">
        {"→"}
      </span>
    </>
  );

  if (chip.onClick) {
    return (
      <button type="button" onClick={chip.onClick} className={cls}>
        {inner}
      </button>
    );
  }
  if (chip.href) {
    return (
      <Link href={chip.href} className={cls}>
        {inner}
      </Link>
    );
  }
  return <span className={cls}>{inner}</span>;
}
