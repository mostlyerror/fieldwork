import { describe, it, expect } from "vitest";
import type { TournamentEvent, EventPlayer } from "@/lib/types";
import {
  eventPeople,
  fieldSummary,
  eventIntel,
  teamLeaderboard,
  registrantLabel,
} from "@/lib/field-intel";

function player(overrides: Partial<EventPlayer> = {}): EventPlayer {
  return {
    id: Math.random().toString(36).slice(2),
    player_name: "Player",
    dupr_rating: null,
    partner_name: null,
    partner_dupr_rating: null,
    team_avg_dupr: null,
    player_id: null,
    partner_id: null,
    live_dupr: null,
    live_dupr_verified: null,
    partner_live_dupr: null,
    partner_live_dupr_verified: null,
    placement: null,
    ...overrides,
  };
}

function event(overrides: Partial<TournamentEvent> = {}): TournamentEvent {
  return {
    id: "e1",
    tournament_id: "t1",
    name: "Men's Doubles (3.0-3.5)",
    event_type: "doubles",
    gender: "men",
    skill_level_min: 3.0,
    skill_level_max: 3.5,
    max_teams: null,
    registered_count: 0,
    avg_dupr: null,
    field_strength: null,
    sandbagger_pct: null,
    players: [],
    ...overrides,
  };
}

describe("eventPeople", () => {
  it("expands doubles entries into two people each", () => {
    const e = event({
      players: [player({ player_name: "A", partner_name: "B" })],
    });
    const people = eventPeople(e);
    expect(people.map((p) => p.name)).toEqual(["A", "B"]);
  });

  it("classifies status: verified / provisional / self / none", () => {
    const e = event({
      players: [
        player({ player_name: "Ver", live_dupr: 3.4, live_dupr_verified: true }),
        player({ player_name: "Prov", live_dupr: 3.2, live_dupr_verified: false }),
        player({ player_name: "Self", dupr_rating: 3.0 }),
        player({ player_name: "None" }),
      ],
    });
    const byName = Object.fromEntries(eventPeople(e).map((p) => [p.name, p.status]));
    expect(byName).toEqual({ Ver: "verified", Prov: "provisional", Self: "self", None: "none" });
  });
});

describe("registrantLabel", () => {
  it("pluralizes by count and event type", () => {
    expect(registrantLabel(1, "doubles")).toBe("1 team");
    expect(registrantLabel(3, "doubles")).toBe("3 teams");
    expect(registrantLabel(1, "singles")).toBe("1 player");
    expect(registrantLabel(0, "singles")).toBe("0 players");
  });
});

describe("fieldSummary", () => {
  it("computes the live-vs-listed delta and people coverage", () => {
    const e = event({
      avg_dupr: 3.0,
      registered_count: 1,
      players: [
        player({
          player_name: "A",
          dupr_rating: 3.0,
          live_dupr: 3.4,
          live_dupr_verified: true,
          partner_name: "B",
          partner_dupr_rating: 3.0,
          partner_live_dupr: 3.2,
          partner_live_dupr_verified: true,
        }),
      ],
    });
    const s = fieldSummary([e]);
    expect(s.listedAvg).toBe(3.0);
    expect(s.liveAvg).toBe(3.3); // (3.4 + 3.2) / 2
    expect(s.delta).toBeCloseTo(0.3, 5);
    expect(s.hasLiveData).toBe(true);
    expect(s.livePeople).toBe(2);
    expect(s.totalPeople).toBe(2);
    expect(s.eventsWithData).toBe(1);
    expect(s.totalEvents).toBe(1);
  });

  it("reports no live data when nothing is verified", () => {
    const e = event({ avg_dupr: 3.1, players: [player({ dupr_rating: 3.1 })] });
    const s = fieldSummary([e]);
    expect(s.hasLiveData).toBe(false);
    expect(s.liveAvg).toBeNull();
    expect(s.delta).toBeNull();
    expect(s.listedAvg).toBe(3.1);
  });
});

describe("eventIntel", () => {
  it("counts rated-live, differ-from-listed, and in/below/above the skill window", () => {
    const e = event({
      skill_level_min: 3.0,
      skill_level_max: 3.5,
      players: [
        // in range, verified, differs from listed
        player({ dupr_rating: 3.0, live_dupr: 3.3, live_dupr_verified: true }),
        // above the 3.5 ceiling (ringer), verified
        player({ dupr_rating: 3.4, live_dupr: 3.8, live_dupr_verified: true }),
        // below the floor, self-rated only
        player({ dupr_rating: 2.5 }),
      ],
    });
    const intel = eventIntel(e);
    expect(intel.ratedLiveCount).toBe(2);
    expect(intel.differCount).toBe(2); // both verified players differ from listed: 3.0->3.3 and 3.4->3.8
    expect(intel.above).toBe(1);
    expect(intel.below).toBe(1);
    expect(intel.inRange).toBe(1);
    expect(intel.unit).toBe("teams");
  });

  it("uses singular unit for singles", () => {
    expect(eventIntel(event({ event_type: "singles" })).unit).toBe("players");
  });
});

describe("teamLeaderboard", () => {
  it("ranks only fully-verified teams by team rating, rest awaiting", () => {
    const e = event({
      players: [
        // fully verified team, avg 3.30
        player({
          player_name: "Shelley",
          live_dupr: 3.46,
          live_dupr_verified: true,
          partner_name: "Tim",
          partner_live_dupr: 3.14,
          partner_live_dupr_verified: true,
        }),
        // fully verified team, avg 3.33 (should rank #1)
        player({
          player_name: "Phyllis",
          live_dupr: 3.45,
          live_dupr_verified: true,
          partner_name: "Joseph",
          partner_live_dupr: 3.21,
          partner_live_dupr_verified: true,
        }),
        // only one verified -> awaiting
        player({
          player_name: "Vy",
          live_dupr: 3.0,
          live_dupr_verified: true,
          partner_name: "Son",
          partner_dupr_rating: 3.0,
          partner_live_dupr_verified: false,
        }),
      ],
    });
    const lb = teamLeaderboard(e);
    expect(lb.isDoubles).toBe(true);
    expect(lb.ranked.map((t) => t.members[0].name)).toEqual(["Phyllis", "Shelley"]);
    expect(lb.ranked[0].rank).toBe(1);
    expect(lb.ranked[0].teamRating).toBe(3.33);
    expect(lb.ranked[1].teamRating).toBe(3.3);
    expect(lb.awaiting.map((t) => t.members[0].name)).toEqual(["Vy"]);
    expect(lb.awaiting[0].rank).toBeNull();
  });
});
