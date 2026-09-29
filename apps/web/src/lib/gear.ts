/**
 * Paddle affiliate links, picked by DUPR rating band.
 *
 * Links are Amazon search pages tagged with NEXT_PUBLIC_AFFILIATE_TAG (an
 * Amazon Associates tracking ID). Search pages instead of product pages so a
 * discontinued paddle never leaves a dead link. With no tag set there is
 * nothing to earn, so callers render nothing.
 */

export type RatingBand = "beginner" | "intermediate" | "advanced";

export interface GearLink {
  label: string;
  blurb: string;
  href: string;
}

export const BAND_LABELS: Record<RatingBand, string> = {
  beginner: "Beginner (under 3.5)",
  intermediate: "Intermediate (3.5 to 4.49)",
  advanced: "Advanced (4.5+)",
};

const PICKS: Record<RatingBand, { label: string; blurb: string; query: string }[]> = {
  beginner: [
    { label: "Wide-body control paddles", blurb: "Big sweet spot, forgiving on off-center hits.", query: "wide body pickleball paddle beginner" },
    { label: "Paddle starter sets", blurb: "Two paddles and balls, good for drilling with a partner.", query: "pickleball paddle set 2 paddles" },
  ],
  intermediate: [
    { label: "Raw carbon fiber paddles", blurb: "More spin and touch for the kitchen game.", query: "raw carbon fiber pickleball paddle 16mm" },
    { label: "Mid-weight all-court paddles", blurb: "Balanced power and control for 3.5 to 4.0 play.", query: "midweight pickleball paddle control" },
  ],
  advanced: [
    { label: "Thermoformed carbon paddles", blurb: "Stiff, fast, and built for put-aways.", query: "thermoformed carbon pickleball paddle" },
    { label: "Elongated power paddles", blurb: "Extra reach and pop for drives and serves.", query: "elongated pickleball paddle power" },
  ],
};

/** Map a DUPR rating to a band. No rating means we guess the middle band. */
export function ratingBand(rating: number | null | undefined): RatingBand {
  if (rating == null || !Number.isFinite(rating)) return "intermediate";
  if (rating < 3.5) return "beginner";
  if (rating < 4.5) return "intermediate";
  return "advanced";
}

/**
 * Band for a tournament: the median skill cap across its events. Open or
 * uncapped events (no max) are skipped; with no caps at all, use the middle band.
 */
export function tournamentBand(
  events: { skill_level_max: number | null }[],
): RatingBand {
  const caps = events
    .map((e) => e.skill_level_max)
    .filter((c): c is number => c != null && Number.isFinite(c))
    .sort((a, b) => a - b);
  if (caps.length === 0) return "intermediate";
  const mid = Math.floor(caps.length / 2);
  const median = caps.length % 2 ? caps[mid] : (caps[mid - 1] + caps[mid]) / 2;
  // A 3.5 cap means players up to 3.5, so treat the cap as just inside the band.
  return ratingBand(median - 0.01);
}

/** Tagged links for a band, or [] when no affiliate tag is configured. */
export function gearLinks(band: RatingBand, tag: string | null | undefined): GearLink[] {
  const t = tag?.trim();
  if (!t) return [];
  return PICKS[band].map((p) => {
    const url = new URL("https://www.amazon.com/s");
    url.searchParams.set("k", p.query);
    url.searchParams.set("tag", t);
    return { label: p.label, blurb: p.blurb, href: url.toString() };
  });
}
