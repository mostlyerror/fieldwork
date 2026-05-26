import type { TournamentEvent } from "./types";

export function effectiveAvgDupr(event: TournamentEvent): number | null {
  const players = event.players;
  if (!players || players.length === 0) return event.avg_dupr;

  const ratings = players
    .map((p) => p.live_dupr ?? p.dupr_rating)
    .filter((r): r is number => r != null);

  if (ratings.length === 0) return event.avg_dupr;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100;
}

export interface AvgDuprPair {
  listed: number | null;
  live: number | null;
  hasLiveData: boolean;
}

export function avgDuprPair(event: TournamentEvent): AvgDuprPair {
  const listed = event.avg_dupr;
  const players = event.players;
  if (!players || players.length === 0) return { listed, live: null, hasLiveData: false };

  const hasLiveData = players.some((p) => p.live_dupr != null && p.live_dupr_verified === true);
  if (!hasLiveData) return { listed, live: null, hasLiveData: false };

  const live = effectiveAvgDupr(event);
  return { listed, live, hasLiveData: true };
}
