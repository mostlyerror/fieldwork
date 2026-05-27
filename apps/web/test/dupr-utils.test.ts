import { describe, it, expect } from "vitest";
import { effectiveAvgDupr, avgDuprPair } from "@/lib/dupr-utils";
import type { TournamentEvent, EventPlayer } from "@/lib/types";

function makePlayer(overrides: Partial<EventPlayer> = {}): EventPlayer {
  return {
    id: "p1",
    player_name: "Test",
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

function makeEvent(overrides: Partial<TournamentEvent> = {}): TournamentEvent {
  return {
    id: "e1",
    tournament_id: "t1",
    name: "Men's Doubles 3.0",
    event_type: "doubles",
    gender: null,
    max_teams: null,
    skill_level_min: null,
    skill_level_max: null,
    registered_count: 0,
    avg_dupr: null,
    field_strength: null,
    sandbagger_pct: null,
    players: [],
    ...overrides,
  };
}

describe("effectiveAvgDupr", () => {
  it("falls back to event.avg_dupr when no players", () => {
    const event = makeEvent({ avg_dupr: 2.88, players: [] });
    expect(effectiveAvgDupr(event)).toBe(2.88);
  });

  it("falls back to event.avg_dupr when players is undefined", () => {
    const event = makeEvent({ avg_dupr: 3.0, players: undefined });
    expect(effectiveAvgDupr(event)).toBe(3.0);
  });

  it("uses live_dupr when available instead of listed", () => {
    const event = makeEvent({
      avg_dupr: 2.88,
      players: [
        makePlayer({ dupr_rating: 2.5, live_dupr: 3.2 }),
        makePlayer({ dupr_rating: 3.0, live_dupr: 3.4 }),
      ],
    });
    // (3.2 + 3.4) / 2 = 3.30
    expect(effectiveAvgDupr(event)).toBe(3.3);
  });

  it("falls back to dupr_rating when live_dupr is null", () => {
    const event = makeEvent({
      avg_dupr: 2.88,
      players: [
        makePlayer({ dupr_rating: 3.0, live_dupr: null }),
        makePlayer({ dupr_rating: 3.2, live_dupr: null }),
      ],
    });
    expect(effectiveAvgDupr(event)).toBe(3.1);
  });

  it("mixes live and listed when only some players are enriched", () => {
    const event = makeEvent({
      avg_dupr: 2.88,
      players: [
        makePlayer({ dupr_rating: 2.5, live_dupr: 3.2 }),
        makePlayer({ dupr_rating: 3.0, live_dupr: null }),
      ],
    });
    // (3.2 + 3.0) / 2 = 3.10
    expect(effectiveAvgDupr(event)).toBe(3.1);
  });

  it("returns null when no players have any rating", () => {
    const event = makeEvent({
      avg_dupr: null,
      players: [makePlayer(), makePlayer()],
    });
    expect(effectiveAvgDupr(event)).toBeNull();
  });

  it("skips players with no rating in the average", () => {
    const event = makeEvent({
      players: [
        makePlayer({ live_dupr: 3.0 }),
        makePlayer(), // no rating at all
      ],
    });
    expect(effectiveAvgDupr(event)).toBe(3.0);
  });
});

describe("avgDuprPair", () => {
  it("returns hasLiveData=false when no verified live ratings exist", () => {
    const event = makeEvent({
      avg_dupr: 3.0,
      players: [
        makePlayer({ dupr_rating: 3.0, live_dupr: null }),
      ],
    });
    const pair = avgDuprPair(event);
    expect(pair.listed).toBe(3.0);
    expect(pair.live).toBeNull();
    expect(pair.hasLiveData).toBe(false);
  });

  it("computes live avg from all players using live when available, listed as fallback", () => {
    const event = makeEvent({
      avg_dupr: 2.88,
      players: [
        makePlayer({ dupr_rating: 2.5, live_dupr: 3.2, live_dupr_verified: true }),
        makePlayer({ dupr_rating: 3.0, live_dupr: 3.4, live_dupr_verified: true }),
        makePlayer({ dupr_rating: 3.0, live_dupr: null }),
      ],
    });
    const pair = avgDuprPair(event);
    expect(pair.listed).toBe(2.88);
    // (3.2 + 3.4 + 3.0) / 3 = 3.2 — verified live for two, listed fallback for third
    expect(pair.live).toBe(3.2);
    expect(pair.hasLiveData).toBe(true);
  });

  it("returns listed from event.avg_dupr, not recomputed", () => {
    const event = makeEvent({
      avg_dupr: 2.88,
      players: [
        makePlayer({ dupr_rating: 3.5, live_dupr: 3.6, live_dupr_verified: true }),
      ],
    });
    const pair = avgDuprPair(event);
    expect(pair.listed).toBe(2.88);
  });
});
