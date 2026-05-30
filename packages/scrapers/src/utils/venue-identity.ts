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
