/**
 * "Suspicious zero" check for scraper runs.
 *
 * PickleballBrackets returned 0 tournaments on every run for a month and each
 * run was logged as `success`. A source that normally finds tournaments and
 * suddenly finds none is almost always blocked or broken, not empty.
 */

/** How many recent healthy runs make up the baseline. */
export const ZERO_CHECK_WINDOW = 10;

/** scraper_runs.status for a run that finished but found a suspicious 0. */
export const SUSPICIOUS_ZERO_STATUS = "suspicious_zero";

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * True when this run found 0 but the source's recent runs usually found some.
 * `recentFound` is tournaments_found from the source's last healthy runs
 * (newest first); only the first ZERO_CHECK_WINDOW are used.
 */
export function isSuspiciousZero(found: number, recentFound: number[]): boolean {
  if (found > 0) return false;
  return median(recentFound.slice(0, ZERO_CHECK_WINDOW)) > 0;
}
