import type { Tournament } from "./types";

/** Build a YYYYMMDD string from an ISO date (YYYY-MM-DD). */
function toCalDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

/** Add one day to a YYYY-MM-DD string and return YYYYMMDD (for exclusive end dates). */
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Google Calendar "add event" URL for an all-day tournament event. */
export function googleCalendarUrl(tournament: Tournament): string {
  const start = toCalDate(tournament.date_start);
  const end = nextDay(tournament.date_end ?? tournament.date_start);

  const location = [tournament.location_name, tournament.location_address]
    .filter(Boolean)
    .join(", ");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: tournament.name,
    dates: `${start}/${end}`,
    location,
    details: `https://pickleradar.app/tournaments/${tournament.id}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** ICS file as a data: URI for downloading a calendar event. */
export function icsDataUrl(tournament: Tournament): string {
  const start = toCalDate(tournament.date_start);
  const end = nextDay(tournament.date_end ?? tournament.date_start);
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const location = [tournament.location_name, tournament.location_address]
    .filter(Boolean)
    .join(", ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PickleRadar//EN",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${tournament.name}`,
    `LOCATION:${location}`,
    `DESCRIPTION:https://pickleradar.app/tournaments/${tournament.id}`,
    `DTSTAMP:${now}`,
    `UID:${tournament.id}@pickleradar.app`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}
