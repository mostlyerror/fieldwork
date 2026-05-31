// Web-side duplicate of the scraper's venue identity helpers. Kept in sync with
// packages/scrapers/src/utils/venue-identity.ts (cross-package import isn't clean;
// same precedent as venue-slug.ts). "park" is distinctive — NOT noise.
// nameSimilarity is intentionally omitted: it's only used in the scraper's fuzzy-match logic, not needed web-side.
const NOISE_TOKENS = new Set([
  "the", "pickleball", "pb", "courts", "court", "club", "center", "centre",
  "complex", "and", "rec", "recreation",
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
