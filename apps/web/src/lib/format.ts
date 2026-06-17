export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateRange(start: string, end: string | null): string {
  if (!end || end === start) return formatDate(start);
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatCurrency(amount: number): string {
  if (amount === 0) return "Free";
  return `$${amount.toFixed(0)}`;
}

/** The calendar date a tournament finishes by — its end, or start if no end. */
export function tournamentEndDate(t: {
  date_start: string;
  date_end: string | null;
}): Date {
  return new Date((t.date_end ?? t.date_start) + "T00:00:00");
}

/** True once a tournament has finished (its end date is before today). */
export function isTournamentPast(
  t: { date_start: string; date_end: string | null },
  now: Date = new Date(),
): boolean {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return tournamentEndDate(t) < today;
}

/**
 * True while registration is still open: the tournament hasn't ended, and
 * either no close date is set or it's still in the future. Prefers the close
 * date over the (often-stale) registration_status flag.
 */
export function isRegistrationOpen(
  t: {
    date_start: string;
    date_end: string | null;
    registration_status: string | null;
    registration_close_date: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (isTournamentPast(t, now)) return false;
  if (t.registration_close_date) {
    return new Date(t.registration_close_date) > now;
  }
  return t.registration_status !== "closed";
}

export function relativeDate(dateStr: string): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";

  // "This weekend" — target is the upcoming Sat or Sun within the same week
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
  if (target.getDay() === 6 && diffDays <= daysUntilSat) return "This weekend";
  if (target.getDay() === 0 && diffDays <= daysUntilSat + 1)
    return "This weekend";

  if (diffDays <= 6) return `In ${diffDays} days`;
  if (diffDays <= 13) return "Next week";
  return null;
}

export function googleMapsUrl({
  latitude,
  longitude,
  address,
  name,
}: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  name?: string | null;
}): string {
  const q = [name, address].filter(Boolean).join(", ") ||
    (latitude != null && longitude != null ? `${latitude},${longitude}` : "");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
