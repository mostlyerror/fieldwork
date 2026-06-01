/**
 * <StatusChip> — the small pill that names a section's health.
 *
 * Pulls its colors from the step-1 semantic scale (ADMIN_STATUS) so every
 * admin surface (source cards, banners, queue rows) reads the same.
 * Presentational only.
 */

import { ADMIN_STATUS, type AdminStatus } from "@/lib/admin-status";

export function StatusChip({
  status,
  label,
}: {
  status: AdminStatus;
  /** Override the default human label (e.g. "Down", "Stale 4h"). */
  label?: string;
}) {
  const tokens = ADMIN_STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.05em] ${tokens.bg} ${tokens.border} ${tokens.text}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${tokens.dot}`}
      />
      {label ?? tokens.label}
    </span>
  );
}
