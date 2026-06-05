/**
 * Adapter layer: turns the raw data-layer outputs (Player, Match[], rating
 * history, partner/record aggregates) into the shapes the copy engine
 * (player-read.ts) and the Scouting Report modules consume.
 *
 * Keeps the derivation logic in one place so the page stays declarative.
 */
import type { Match, Player, PlayerRecord, FrequentPartner } from "@/lib/types";
import type { PlayerReadInput, PartnerStat } from "@/lib/player-read";
import type { PartnerRow } from "@/components/player/types";

type RatingPointLike = { event_date: string; rating: number };

/** Did `playerId`'s team win this match? Mirrors the page's getMatchWon. */
function matchWon(match: Match, playerId: string): boolean {
  const onTeam1 =
    match.team1_player1_id === playerId || match.team1_player2_id === playerId;
  return onTeam1 ? match.team1_won : !match.team1_won;
}

/** Pull {wins,losses} for a format family out of computePlayerRecord output. */
function recordFor(
  records: PlayerRecord[],
  match: (format: string) => boolean,
): { wins: number; losses: number } {
  return records.reduce(
    (acc, r) => {
      if (match(r.format)) {
        acc.wins += r.wins;
        acc.losses += r.losses;
      }
      return acc;
    },
    { wins: 0, losses: 0 },
  );
}

const isDoublesFormat = (fmt: string) => /doubles/i.test(fmt);
const isSinglesFormat = (fmt: string) => /singles/i.test(fmt);

/**
 * Build the PlayerReadInput the deterministic copy engine consumes.
 *
 * - ratingDelta: last DOUBLES rating minus the rating ~10 points earlier
 *   (or the earliest available if fewer than 10 points).
 * - peak / low: max / min over the DOUBLES rating series.
 * - doubles / singles records summed from computePlayerRecord output.
 * - partners mapped from computeFrequentPartners output (matchCount → matches).
 * - recentResults: most-recent-first ("W"|"L")[] for up to the last ~8 matches.
 */
export function toPlayerReadInput(args: {
  player: Player;
  matches: Match[];
  ratingHistory: RatingPointLike[];
  partners: FrequentPartner[];
  records: PlayerRecord[];
  playerId: string;
}): PlayerReadInput {
  const { player, matches, ratingHistory, partners, records, playerId } = args;

  // Rating series stats (DOUBLES history, oldest → newest).
  const series = ratingHistory.map((p) => p.rating);
  let ratingDelta: number | null = null;
  let peak: number | null = null;
  let low: number | null = null;
  if (series.length > 0) {
    peak = Math.max(...series);
    low = Math.min(...series);
    if (series.length >= 2) {
      const last = series[series.length - 1];
      const priorIdx = Math.max(0, series.length - 1 - 10);
      ratingDelta = Math.round((last - series[priorIdx]) * 1000) / 1000;
    }
  }

  const doubles = recordFor(records, isDoublesFormat);
  const singles = recordFor(records, isSinglesFormat);

  const partnerStats: PartnerStat[] = partners.map((p) => ({
    name: p.name,
    wins: p.wins,
    losses: p.losses,
    matches: p.matchCount,
  }));

  // matches arrive most-recent-first (getPlayerMatches orders desc).
  const recentResults: ("W" | "L")[] = matches
    .slice(0, 8)
    .map((m) => (matchWon(m, playerId) ? "W" : "L"));

  return {
    playerId,
    name: player.name,
    duprDoubles: player.dupr_doubles,
    duprSingles: player.dupr_singles,
    verified: player.dupr_verified === true,
    ratingDelta,
    peak,
    low,
    doubles,
    singles,
    partners: partnerStats,
    recentResults,
  };
}

/** Trend label for the rating chart, from a signed delta. */
export function deriveTrendLabel(delta: number | null): string {
  if (delta == null) return "Steady";
  if (delta >= 0.1) return "On the rise";
  if (delta <= -0.1) return "Cooling";
  return "Steady";
}

/** Partner-chemistry verdict, matching player-read.ts thresholds. */
function partnerVerdict(winRate: number, matches: number): string | null {
  if (matches < 3) return null;
  if (winRate >= 75) return "Elite duo";
  if (winRate >= 55) return "Reliable pairing";
  if (winRate >= 40) return "Still gelling";
  return "Snakebit together";
}

/** Build PartnerChemistryProps.partners (PartnerRow[]) from frequent partners. */
export function buildPartnerRows(partners: FrequentPartner[]): PartnerRow[] {
  return partners.map((p) => {
    const matches = p.matchCount;
    const winRate = matches === 0 ? 0 : Math.round((p.wins / matches) * 100);
    return {
      name: p.name,
      playerId: p.playerId,
      wins: p.wins,
      losses: p.losses,
      matches,
      winRate,
      verdict: partnerVerdict(winRate, matches),
    };
  });
}
