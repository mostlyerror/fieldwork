/**
 * Parse a PickleballBrackets per-event date string into a start time.
 *
 * The tourneyEvents API gives strings like "Jun 7 2026 8:30 AM" in the venue's
 * local time (Houston = America/Chicago). We keep the raw string for faithful
 * display and also compute a tz-correct UTC instant for sorting / calendar use.
 */

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const VENUE_TZ = "America/Chicago";

/** Offset (tz − UTC) in ms at the given instant, for a named time zone. */
function tzOffsetMs(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asTZ = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asTZ - date.getTime();
}

export interface ParsedEventTime {
  /** ISO UTC instant, or null if unparseable. */
  iso: string | null;
  /** The exact source string (trimmed), or null if absent. */
  raw: string | null;
}

export function parsePbbEventDate(raw?: string | null): ParsedEventTime {
  if (!raw || !raw.trim()) return { iso: null, raw: null };
  const s = raw.trim();
  const m = s.match(/([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return { iso: null, raw: s };
  const monKey = m[1][0].toUpperCase() + m[1].slice(1, 3).toLowerCase();
  const mon = MONTHS[monKey];
  if (mon == null) return { iso: null, raw: s };

  let hour = +m[4] % 12;
  if (/pm/i.test(m[6])) hour += 12;
  const day = +m[2], year = +m[3], min = +m[5];

  // Treat the parsed wall-clock as America/Chicago, convert to UTC.
  const naiveUTC = Date.UTC(year, mon, day, hour, min);
  const offset = tzOffsetMs(VENUE_TZ, new Date(naiveUTC));
  return { iso: new Date(naiveUTC - offset).toISOString(), raw: s };
}
