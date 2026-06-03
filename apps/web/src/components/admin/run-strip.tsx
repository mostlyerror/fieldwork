/**
 * <RunStrip> — GitHub-contributions-style reliability viz.
 *
 * A row of small squares, one per scraper run, green for success and red for
 * failure (oldest → newest, left → right). The instant read on "is this source
 * flaky?" Presentational only.
 */

import { ADMIN_STATUS } from "@/lib/admin-status";

export interface RunStripItem {
  /** "success" = green, "error" = red. */
  status: "success" | "error";
}

const OK_FILL = ADMIN_STATUS.healthy.dot; // bg-emerald-500
const ERR_FILL = ADMIN_STATUS.critical.dot; // bg-red-500

export function RunStrip({
  runs,
  caption,
  className = "",
}: {
  /** Oldest → newest. */
  runs: RunStripItem[];
  /** Optional caption row under the strip, e.g. ["30 runs ago", "29/30 ok"]. */
  caption?: [left: React.ReactNode, right: React.ReactNode];
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-end gap-[3px]">
        {runs.map((run, i) => (
          <span
            key={i}
            className={`h-[22px] flex-1 rounded-[3px] ${
              run.status === "error" ? ERR_FILL : `${OK_FILL} opacity-90`
            }`}
          />
        ))}
      </div>
      {caption && (
        <div className="t-caption mt-1.5 flex justify-between text-emerald-900/40">
          <span>{caption[0]}</span>
          <span>{caption[1]}</span>
        </div>
      )}
    </div>
  );
}
