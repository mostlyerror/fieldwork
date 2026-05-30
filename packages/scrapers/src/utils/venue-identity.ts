// packages/scrapers/src/utils/venue-identity.ts
// "park" is distinctive — deliberately NOT in NOISE_TOKENS.
const NOISE_TOKENS = new Set([
  "the", "pickleball", "pb", "courts", "court", "club", "center", "centre",
  "complex", "and", "rec", "recreation",
  // Non-geographic labels normalize to nothing so their dedup key is stable.
  "unknown", "online", "tbd", "tba",
]);

export function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length > 0 && !NOISE_TOKENS.has(tok))
    .join(" ")
    .trim();
}

export function nameSimilarity(a: string, b: string): number {
  const at = new Set(a.split(/\s+/).filter(Boolean));
  const bt = new Set(b.split(/\s+/).filter(Boolean));
  if (at.size === 0 || bt.size === 0) return 0;
  // Subset → treat as full match.
  const aSubset = [...at].every((t) => bt.has(t));
  const bSubset = [...bt].every((t) => at.has(t));
  if (aSubset || bSubset) return 1;
  const inter = [...at].filter((t) => bt.has(t)).length;
  const union = new Set([...at, ...bt]).size;
  return inter / union;
}

export function roundCoord(c: number | null | undefined): string {
  if (c == null || Number.isNaN(c)) return "na";
  return c.toFixed(5);
}

export interface DedupKeyInput {
  placeId: string | null;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export function venueDedupKey(input: DedupKeyInput): string {
  if (input.placeId) return `place:${input.placeId}`;
  return `loc:${normalizeVenueName(input.name)}:${roundCoord(input.latitude)}:${roundCoord(input.longitude)}`;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Produce a specific, disambiguated venue display name.
 *
 * Google Places often returns the bare chain name ("Life Time") or a raw street
 * address ("8421 Hwy 6"), which makes sibling locations indistinguishable. We
 * keep the Places name as the base (or fall back to the scraped name when Places
 * gave an address), then append the locale token the scraped name carries that
 * the base lacks — e.g. base "Life Time" + scraped "Life Time Greenway" →
 * "Life Time — Greenway"; base "Life Time" + scraped "Champions" →
 * "Life Time — Champions". When the scraped name adds nothing, the base stands.
 */
export function venueDisplayName(placesName: string, scrapedName: string): string {
  const addressLike = /^\s*\d/.test(placesName);
  const base = (addressLike && scrapedName.trim() ? scrapedName : placesName).trim();
  const baseNorm = normalizeVenueName(base);
  const baseTokens = new Set(baseNorm.split(/\s+/).filter(Boolean));
  const extra = normalizeVenueName(scrapedName)
    .split(/\s+/)
    .filter((t) => t && !baseTokens.has(t));
  const suffix = extra.join(" ");
  if (suffix && !baseNorm.includes(suffix)) {
    return `${base} — ${titleCase(suffix)}`;
  }
  return base;
}

/** True when `name` carries a locale suffix (more specific than a bare name). */
export function hasLocaleSuffix(name: string): boolean {
  return name.includes(" — ");
}
