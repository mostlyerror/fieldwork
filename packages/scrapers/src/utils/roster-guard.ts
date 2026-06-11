/**
 * A scrape that found zero players for a tournament that already has player
 * rows is treated as a degraded read, not truth: PBB swaps its events page to
 * a "Completed / Draws & Results" layout once play starts (no Registered/All
 * buttons, so the DOM scrape sees nothing), and replacing real rosters with
 * that empty read also nulls source_event_id — which severs urgent-refresh,
 * placements, and the live bracket for good.
 */
export function isDestructiveEventReplace(
  freshPlayerCount: number,
  existingPlayerCount: number,
): boolean {
  return freshPlayerCount === 0 && existingPlayerCount > 0;
}
