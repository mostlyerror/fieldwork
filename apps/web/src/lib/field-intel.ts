/**
 * Field-intelligence derivations for the tournament detail page.
 *
 * Pure functions that turn raw events/players into the numbers the redesigned
 * Field Intelligence UI displays: the live-vs-listed delta headline, per-bracket
 * coverage flags, the rating-spread classification (in/below/above the skill
 * window), and the team leaderboard split into ranked-verified vs awaiting.
 *
 * Units note: `registered_count` is the registration count — teams for doubles,
 * players for singles. "People" counts below expand each doubles entry into its
 * two players, so coverage stats ("X of Y entrants rated live") are in people.
 */

import type { TournamentEvent, EventPlayer } from "./types";

const EPS = 0.05;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type RatingStatus = "verified" | "provisional" | "self" | "none";

export interface Person {
  name: string;
  id: string | null;
  listed: number | null; // self-reported at registration
  live: number | null; // DUPR-sourced
  verified: boolean; // live rating is reliability-verified
  status: RatingStatus;
  rating: number | null; // effective rating: live ?? listed
}

function makePerson(
  name: string,
  id: string | null,
  listed: number | null,
  live: number | null,
  verified: boolean | null,
): Person {
  const isVerified = verified === true && live != null;
  let status: RatingStatus;
  if (isVerified) status = "verified";
  else if (live != null) status = "provisional";
  else if (listed != null) status = "self";
  else status = "none";
  return { name, id, listed, live, verified: isVerified, status, rating: live ?? listed };
}

/** "1 team" / "3 teams" / "1 player" — pluralized registrant label. */
export function registrantLabel(count: number, eventType: string | null): string {
  const noun = eventType === "singles" ? "player" : "team";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Expand an event's entries into individual people (doubles → 2 per entry). */
export function eventPeople(event: TournamentEvent): Person[] {
  const people: Person[] = [];
  for (const p of event.players ?? []) {
    people.push(makePerson(p.player_name, p.player_id, p.dupr_rating, p.live_dupr, p.live_dupr_verified));
    if (p.partner_name != null) {
      people.push(
        makePerson(
          p.partner_name,
          p.partner_id,
          p.partner_dupr_rating,
          p.partner_live_dupr,
          p.partner_live_dupr_verified,
        ),
      );
    }
  }
  return people;
}

// ---------------------------------------------------------------------------
// Tournament-level summary
// ---------------------------------------------------------------------------

export interface FieldSummary {
  listedAvg: number | null;
  liveAvg: number | null;
  delta: number | null; // liveAvg - listedAvg, only when both exist & live data present
  hasLiveData: boolean;
  livePeople: number; // people with a verified live rating
  totalPeople: number; // people we have any record of
  totalRegistered: number; // sum of registered_count (teams for doubles)
  eventsWithData: number;
  totalEvents: number;
}

function listedAvgOf(event: TournamentEvent): number | null {
  if (event.avg_dupr != null) return event.avg_dupr;
  const listed = eventPeople(event)
    .map((p) => p.listed)
    .filter((r): r is number => r != null);
  return listed.length ? round2(listed.reduce((a, b) => a + b, 0) / listed.length) : null;
}

function liveAvgOf(event: TournamentEvent): number | null {
  const live = eventPeople(event)
    .filter((p) => p.verified && p.live != null)
    .map((p) => p.live!);
  return live.length ? round2(live.reduce((a, b) => a + b, 0) / live.length) : null;
}

export function fieldSummary(events: TournamentEvent[]): FieldSummary {
  const listedVals: number[] = [];
  const liveVals: number[] = [];
  let livePeople = 0;
  let totalPeople = 0;
  let totalRegistered = 0;
  let eventsWithData = 0;

  for (const e of events) {
    totalRegistered += e.registered_count ?? 0;
    const people = eventPeople(e);
    totalPeople += people.length;
    livePeople += people.filter((p) => p.status === "verified").length;
    const la = listedAvgOf(e);
    const lv = liveAvgOf(e);
    if (la != null) listedVals.push(la);
    if (lv != null) liveVals.push(lv);
    if (la != null || lv != null) eventsWithData += 1;
  }

  const listedAvg = listedVals.length ? round2(listedVals.reduce((a, b) => a + b, 0) / listedVals.length) : null;
  const liveAvg = liveVals.length ? round2(liveVals.reduce((a, b) => a + b, 0) / liveVals.length) : null;
  const hasLiveData = liveAvg != null;
  const delta = hasLiveData && listedAvg != null ? round2(liveAvg! - listedAvg) : null;

  return {
    listedAvg,
    liveAvg,
    delta,
    hasLiveData,
    livePeople,
    totalPeople,
    totalRegistered,
    eventsWithData,
    totalEvents: events.length,
  };
}

// ---------------------------------------------------------------------------
// Per-event intel (bracket card flags + chart classification)
// ---------------------------------------------------------------------------

export interface EventIntel {
  listedAvg: number | null;
  liveAvg: number | null;
  delta: number | null;
  hasLiveData: boolean;
  ratedLiveCount: number; // people with a verified live rating
  totalPeople: number;
  registeredCount: number; // teams (doubles) or players (singles)
  unit: "teams" | "players";
  differCount: number; // verified people whose live rating differs from listed > 0.05
  // rating-spread classification (only meaningful when skill window present)
  skillMin: number | null;
  skillMax: number | null;
  inRange: number;
  below: number;
  above: number; // "ringers" above the ceiling
  ratingMin: number | null;
  ratingMax: number | null;
}

export function eventIntel(event: TournamentEvent): EventIntel {
  const people = eventPeople(event);
  const listedAvg = listedAvgOf(event);
  const liveAvg = liveAvgOf(event);
  const hasLiveData = liveAvg != null;
  const delta = hasLiveData && listedAvg != null ? round2(liveAvg! - listedAvg) : null;

  const ratedLiveCount = people.filter((p) => p.status === "verified").length;
  const differCount = people.filter(
    (p) => p.status === "verified" && p.live != null && p.listed != null && Math.abs(p.live - p.listed) > EPS,
  ).length;

  const skillMin = event.skill_level_min;
  const skillMax = event.skill_level_max;
  const ratings = people.map((p) => p.rating).filter((r): r is number => r != null);

  let inRange = 0;
  let below = 0;
  let above = 0;
  if (skillMin != null || skillMax != null) {
    for (const r of ratings) {
      if (skillMax != null && r > skillMax + EPS) above += 1;
      else if (skillMin != null && r < skillMin - EPS) below += 1;
      else inRange += 1;
    }
  }

  return {
    listedAvg,
    liveAvg,
    delta,
    hasLiveData,
    ratedLiveCount,
    totalPeople: people.length,
    registeredCount: event.registered_count ?? 0,
    unit: event.event_type === "singles" ? "players" : "teams",
    differCount,
    skillMin,
    skillMax,
    inRange,
    below,
    above,
    ratingMin: ratings.length ? Math.min(...ratings) : null,
    ratingMax: ratings.length ? Math.max(...ratings) : null,
  };
}

// ---------------------------------------------------------------------------
// Rating histogram (for the unit-square distribution chart + collapsed strip)
// ---------------------------------------------------------------------------

export type Zone = "below" | "in" | "above";

/** Classify a rating relative to the bracket's skill window. */
export function classifyZone(
  rating: number,
  skillMin: number | null,
  skillMax: number | null,
): Zone {
  if (skillMax != null && rating > skillMax + EPS) return "above";
  if (skillMin != null && rating < skillMin - EPS) return "below";
  return "in";
}

export interface RatingBin {
  rating: number; // bin center, e.g. 3.6
  count: number;
  zone: Zone;
}

export interface RatingHistogram {
  bins: RatingBin[];
  maxStack: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  total: number;
}

/** Bin the field's effective ratings (live ?? listed) for the unit-square chart. */
export function ratingHistogram(event: TournamentEvent, step = 0.1): RatingHistogram {
  const ratings = eventPeople(event)
    .map((p) => p.rating)
    .filter((r): r is number => r != null);
  if (ratings.length === 0) {
    return { bins: [], maxStack: 0, avg: null, min: null, max: null, total: 0 };
  }
  const counts = new Map<number, number>();
  for (const r of ratings) {
    const key = Math.round(r / step) * step;
    const rounded = Math.round(key * 100) / 100;
    counts.set(rounded, (counts.get(rounded) ?? 0) + 1);
  }
  const bins: RatingBin[] = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rating, count]) => ({
      rating,
      count,
      zone: classifyZone(rating, event.skill_level_min, event.skill_level_max),
    }));
  return {
    bins,
    maxStack: Math.max(...bins.map((b) => b.count)),
    avg: round2(ratings.reduce((a, b) => a + b, 0) / ratings.length),
    min: Math.min(...ratings),
    max: Math.max(...ratings),
    total: ratings.length,
  };
}

// ---------------------------------------------------------------------------
// Team leaderboard
// ---------------------------------------------------------------------------

export interface LbMember {
  name: string;
  id: string | null;
  rating: number | null;
  status: RatingStatus;
}

export interface LbTeam {
  key: string;
  members: LbMember[];
  teamRating: number | null; // avg of members' effective ratings, when all present
  verified: boolean; // every member has a verified live rating
  rank: number | null; // assigned only to ranked (verified) teams
}

export interface Leaderboard {
  isDoubles: boolean;
  ranked: LbTeam[]; // verified teams, sorted by teamRating desc
  awaiting: LbTeam[]; // everyone else, registration order
}

function memberOf(p: Person): LbMember {
  return { name: p.name, id: p.id, rating: p.rating, status: p.status };
}

export function teamLeaderboard(event: TournamentEvent): Leaderboard {
  const isDoubles = (event.players ?? []).some((p) => p.partner_name != null);
  const teams: LbTeam[] = (event.players ?? []).map((p, i) => {
    const members: LbMember[] = [
      memberOf(makePerson(p.player_name, p.player_id, p.dupr_rating, p.live_dupr, p.live_dupr_verified)),
    ];
    if (p.partner_name != null) {
      members.push(
        memberOf(
          makePerson(
            p.partner_name,
            p.partner_id,
            p.partner_dupr_rating,
            p.partner_live_dupr,
            p.partner_live_dupr_verified,
          ),
        ),
      );
    }
    const ratings = members.map((m) => m.rating).filter((r): r is number => r != null);
    const teamRating = ratings.length === members.length ? round2(ratings.reduce((a, b) => a + b, 0) / members.length) : null;
    const verified = members.every((m) => m.status === "verified");
    return { key: p.id ?? `team-${i}`, members, teamRating, verified, rank: null };
  });

  const ranked = teams
    .filter((t) => t.verified && t.teamRating != null)
    .sort((a, b) => b.teamRating! - a.teamRating!)
    .map((t, i) => ({ ...t, rank: i + 1 }));

  const rankedKeys = new Set(ranked.map((t) => t.key));
  const awaiting = teams.filter((t) => !rankedKeys.has(t.key));

  return { isDoubles, ranked, awaiting };
}
