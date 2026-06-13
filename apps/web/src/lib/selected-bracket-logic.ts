/**
 * Pure helpers for the shared bracket selection synced between the Field
 * Intelligence and Bracket & Results sections of the tournament detail page.
 */

/**
 * The tab Bracket & Results should show given the shared selection.
 *
 * Bracket & Results only contains the events that have match data — a subset of
 * all events. It adopts the shared `selectedEventId` only when that event is one
 * it actually has; otherwise it keeps its current tab, so selecting an
 * FI-only bracket in Field Intelligence never resets the Bracket & Results tab.
 */
export function nextBracketKey(
  selectedEventId: string | null,
  eventKeys: string[],
  currentKey: string,
): string {
  if (selectedEventId != null && eventKeys.includes(selectedEventId)) {
    return selectedEventId;
  }
  return currentKey;
}
