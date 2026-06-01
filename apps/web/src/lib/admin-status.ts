/**
 * Admin semantic status — the single color contract for the admin operator tool.
 *
 * Three states, ordered by severity:
 *   healthy   — green   — all good, nothing to do
 *   attention — amber   — aging / degraded, act soon before it rots
 *   critical  — red     — down / stale / blocking, act now
 *
 * Every admin component (status banners, source cards, queue stripes, nav dots)
 * pulls its colors from here so the palette stays consistent. Tailwind classes
 * use the brand emerald/amber/red ramps that match the public site.
 */

export type AdminStatus = "healthy" | "attention" | "critical";

/** Tailwind class tokens for a single status. */
export interface AdminStatusTokens {
  /** Foreground text color, e.g. status labels. */
  text: string;
  /** Soft tinted surface background. */
  bg: string;
  /** Border that pairs with `bg`. */
  border: string;
  /** Solid fill color for dots / stripes (uses bg-* utility). */
  dot: string;
  /** Human label for the status. */
  label: string;
}

export const ADMIN_STATUS: Record<AdminStatus, AdminStatusTokens> = {
  healthy: {
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    label: "Healthy",
  },
  attention: {
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
    label: "Attention",
  },
  critical: {
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
    label: "Critical",
  },
};

/** Severity order, lowest → highest. */
const STATUS_RANK: Record<AdminStatus, number> = {
  healthy: 0,
  attention: 1,
  critical: 2,
};

/**
 * Pick the worst (highest-severity) status from several.
 * Returns "healthy" when given nothing.
 */
export function worstStatus(...statuses: AdminStatus[]): AdminStatus {
  return statuses.reduce<AdminStatus>(
    (worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst),
    "healthy"
  );
}
