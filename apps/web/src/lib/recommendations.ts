import type { Tournament, TournamentEvent } from "./types";
import { distanceMiles } from "./format";

interface UserProfile {
  dupr_rating_doubles: number | null;
  dupr_rating_singles: number | null;
  location_latitude: number | null;
  location_longitude: number | null;
}

interface ScoredTournament {
  tournament: Tournament;
  score: number;
  reason: string;
}

const WEIGHTS = {
  skillMatch: 0.4,
  fieldFriendliness: 0.25,
  proximity: 0.2,
  dateSoon: 0.15,
};

const MAX_DISTANCE = 50; // miles
const MAX_DAYS = 60;

export function scoreAndRankTournaments(
  tournaments: Tournament[],
  user: UserProfile,
  events: Map<string, TournamentEvent[]>,
): ScoredTournament[] {
  const userDupr = user.dupr_rating_doubles ?? user.dupr_rating_singles;
  if (userDupr == null) return [];

  const now = new Date();
  const scored: ScoredTournament[] = [];

  for (const tournament of tournaments) {
    const tournamentEvents = events.get(tournament.id) ?? [];
    if (tournamentEvents.length === 0 && tournament.avg_field_strength == null) {
      continue;
    }

    // Find the best-matching event for this user
    let bestSkillMatch = 0;
    let bestFieldFriendliness = 0;
    let matchingEventName: string | null = null;

    for (const event of tournamentEvents) {
      if (event.skill_level_min == null || event.skill_level_max == null) continue;
      if (event.avg_dupr == null) continue;

      const range = event.skill_level_max - event.skill_level_min;
      const skillMatch =
        range > 0
          ? Math.max(0, 1 - Math.abs(userDupr - event.avg_dupr) / range)
          : userDupr >= event.skill_level_min && userDupr <= event.skill_level_max
            ? 1
            : 0;

      const fieldFriendliness = 1 - (event.field_strength ?? 0.5);

      if (skillMatch > bestSkillMatch) {
        bestSkillMatch = skillMatch;
        bestFieldFriendliness = fieldFriendliness;
        matchingEventName = event.name;
      }
    }

    // Fall back to tournament-level aggregates if no events matched
    if (bestSkillMatch === 0 && tournament.avg_field_strength != null) {
      bestSkillMatch = 0.5;
      bestFieldFriendliness = 1 - tournament.avg_field_strength;
    }

    if (bestSkillMatch === 0) continue;

    // Proximity score
    let proximity = 0.5; // default if no location data
    if (
      user.location_latitude != null &&
      user.location_longitude != null &&
      tournament.latitude != null &&
      tournament.longitude != null
    ) {
      const dist = distanceMiles(
        user.location_latitude,
        user.location_longitude,
        tournament.latitude,
        tournament.longitude,
      );
      proximity = Math.max(0, 1 - dist / MAX_DISTANCE);
    }

    // Date proximity score
    const tournamentDate = new Date(tournament.date_start);
    const daysUntil = Math.max(
      0,
      (tournamentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    const dateSoon = Math.max(0, 1 - daysUntil / MAX_DAYS);

    const score =
      WEIGHTS.skillMatch * bestSkillMatch +
      WEIGHTS.fieldFriendliness * bestFieldFriendliness +
      WEIGHTS.proximity * proximity +
      WEIGHTS.dateSoon * dateSoon;

    // Generate reason
    let reason: string;
    if (bestSkillMatch > 0.7 && bestFieldFriendliness > 0.6) {
      reason = "Great match — field is friendly at your level";
    } else if (bestSkillMatch > 0.7) {
      reason = "Good skill match for your level";
    } else if (bestFieldFriendliness > 0.6) {
      reason = "Friendly field — good for building confidence";
    } else if (bestSkillMatch > 0.4) {
      reason = "Competitive field but you'd hold your own";
    } else {
      reason = matchingEventName
        ? `Closest match: ${matchingEventName}`
        : "Nearby tournament at your level";
    }

    scored.push({ tournament, score, reason });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
}
