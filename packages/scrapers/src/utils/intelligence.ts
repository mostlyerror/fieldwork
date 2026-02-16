/**
 * Intelligence computation functions for field strength analysis.
 */

import type { ScrapedPlayer } from "../types.js";

/**
 * Compute where the average DUPR sits in the bracket range (0.0 = bottom, 1.0 = top).
 * A higher value means the field is playing closer to the top of the allowed range.
 */
export function computeFieldStrength(
  skillMin: number,
  skillMax: number,
  avgDupr: number,
): number {
  const range = skillMax - skillMin;
  if (range === 0) return 0.5;
  return Math.max(0, Math.min(1, (avgDupr - skillMin) / range));
}

/**
 * Compute the percentage of players with ratings in the top 20% of the bracket range.
 * A high sandbagger percentage indicates players clustered near the ceiling.
 */
export function computeSandbaggerPct(
  players: ScrapedPlayer[],
  skillMin: number,
  skillMax: number,
): number {
  const range = skillMax - skillMin;
  if (range === 0) return 0;

  const threshold = skillMin + range * 0.8;
  const withRating = players.filter((p) => p.duprRating != null);
  if (withRating.length === 0) return 0;

  const sandbagging = withRating.filter((p) => p.duprRating! >= threshold);
  return sandbagging.length / withRating.length;
}

/**
 * Compute average DUPR rating from a list of players.
 * Only considers players that have a rating.
 */
export function computeAvgDupr(players: ScrapedPlayer[]): number | null {
  const withRating = players.filter((p) => p.duprRating != null);
  if (withRating.length === 0) return null;
  const sum = withRating.reduce((acc, p) => acc + p.duprRating!, 0);
  return Math.round((sum / withRating.length) * 100) / 100;
}
