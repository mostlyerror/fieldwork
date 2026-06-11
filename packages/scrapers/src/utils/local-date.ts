/**
 * Venue-local calendar date.
 *
 * Every date-windowed job (live matches, urgent refresh, "has this tournament
 * started yet") must reason in the venue's timezone, not UTC. All covered
 * tournaments are Houston-area for now, and the UTC day flips at 6–7 PM
 * Central — so an evening one-day tournament looked "already over" to any
 * UTC-dated window while its matches were still being played.
 */
export const VENUE_TIMEZONE = "America/Chicago";

/** YYYY-MM-DD in the venue's local timezone (en-CA locale formats ISO-style). */
export function localDateString(now: Date = new Date(), timeZone: string = VENUE_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
