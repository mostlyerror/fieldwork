/** Pure aggregation/formatting for venue cards — no Supabase, unit-testable. */

export interface VenueCardModel {
  id: string;
  slug: string;
  name: string;
  photoUrl: string | null;
  shortCity: string | null;
  total: number;
  upcomingCount: number;
  nextDate: string | null; // ISO date of the next upcoming tournament
}

interface VenueInput {
  id: string;
  slug: string;
  name: string;
  photo_url: string | null;
  formatted_address: string | null;
}

interface TournamentInput {
  venue_id: string | null;
  date_start: string;
  date_end: string | null;
}

/** "1331 Hwy 6, Sugar Land, TX 77478, USA" → "Sugar Land, TX" */
export function shortCity(formattedAddress: string | null): string | null {
  if (!formattedAddress) return null;
  const parts = formattedAddress.split(",").map((p) => p.trim());
  // Google format ends [..., City, "ST ZIP", Country]; city is 3rd from last.
  if (parts.length < 3) return null;
  const city = parts[parts.length - 3];
  const state = parts[parts.length - 2].split(" ")[0];
  if (!city || !state) return null;
  return `${city}, ${state}`;
}

/** "2026-08-12" → "Aug 12" */
export function shortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function buildVenueCards(
  venues: VenueInput[],
  tournaments: TournamentInput[],
  today: string,
): VenueCardModel[] {
  const stats = new Map<string, { total: number; upcoming: string[] }>();
  for (const t of tournaments) {
    if (!t.venue_id) continue;
    const s = stats.get(t.venue_id) ?? { total: 0, upcoming: [] };
    s.total++;
    // Same still-upcoming rule as getVenueTournaments: live until date_end passes.
    if ((t.date_end ?? t.date_start) >= today) s.upcoming.push(t.date_start);
    stats.set(t.venue_id, s);
  }

  const cards: VenueCardModel[] = [];
  for (const v of venues) {
    const s = stats.get(v.id);
    if (!s) continue;
    s.upcoming.sort();
    cards.push({
      id: v.id,
      slug: v.slug,
      name: v.name,
      photoUrl: v.photo_url,
      shortCity: shortCity(v.formatted_address),
      total: s.total,
      upcomingCount: s.upcoming.length,
      nextDate: s.upcoming[0] ?? null,
    });
  }

  return cards.sort(
    (a, b) =>
      b.upcomingCount - a.upcomingCount ||
      b.total - a.total ||
      a.name.localeCompare(b.name),
  );
}

/** Index-card one-liner: "9 tournaments · 4 upcoming" / "2 tournaments hosted" */
export function cadenceLine(m: Pick<VenueCardModel, "total" | "upcomingCount">): string {
  const noun = m.total === 1 ? "tournament" : "tournaments";
  if (m.upcomingCount > 0) return `${m.total} ${noun} · ${m.upcomingCount} upcoming`;
  return `${m.total} ${noun} hosted`;
}

/** OG-card line: "9 tournaments hosted · Next on Aug 12" */
export function venueOgLine(total: number, nextDate: string | null): string {
  const base = `${total} ${total === 1 ? "tournament" : "tournaments"} hosted`;
  return nextDate ? `${base} · Next on ${shortDate(nextDate)}` : base;
}
