import type { PlayerFits, PlayerFacts } from "./player-read";
import type { Match } from "./types";

/**
 * Badge engine — a presentation layer over the same `fits`/`facts` classifier
 * that powers The Read, plus a pass over raw match games for the score-based
 * ("did something cool happen") badges. Deterministic, no LLM, no per-request
 * cost. A badge can never contradict The Read because they share a source.
 */

export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export type BadgeIcon =
  | "trending-up"
  | "trending-down"
  | "flame"
  | "shuffle"
  | "users"
  | "user"
  | "swap"
  | "link"
  | "peak"
  | "shield"
  | "pickle"
  | "slayer"
  | "comeback"
  | "target";

export interface Badge {
  id: string;
  name: string;
  tagline: string; // the "why they earned it"
  rarity: Rarity;
  icon: BadgeIcon;
}

const RARITY_ORDER: Record<Rarity, number> = { legendary: 0, rare: 1, uncommon: 2, common: 3 };

/** Per-match signals the fits engine doesn't capture — needs the raw game scores. */
export interface MatchSignals {
  pickle: boolean; // won a game 11-0
  comebackWins: number; // won the match after dropping game 1
  clutchWins: number; // won a match that went to a deciding game 3
  giantSlayer: { count: number; bestMargin: number } | null; // beat a team rated well above
}

const GIANT_MARGIN = 0.5; // opponent avg this far above you = a "giant"

type Game = { mine: number; theirs: number } | null;

function game(a: number | null, b: number | null, onTeam1: boolean): Game {
  if (a == null || b == null) return null;
  return onTeam1 ? { mine: a, theirs: b } : { mine: b, theirs: a };
}

export function deriveMatchSignals(
  matches: Match[],
  playerId: string,
  opponentRatings: Map<string, number>,
  playerRating: number | null,
): MatchSignals {
  let pickle = false;
  let comebackWins = 0;
  let clutchWins = 0;
  let giantCount = 0;
  let bestMargin = 0;

  for (const m of matches) {
    const onTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId;
    const won = onTeam1 ? m.team1_won : !m.team1_won;

    const g1 = game(m.game1_team1, m.game1_team2, onTeam1);
    const g2 = game(m.game2_team1, m.game2_team2, onTeam1);
    const g3 = game(m.game3_team1, m.game3_team2, onTeam1);

    // Pickle — won any game 11-0 (you pickled them).
    for (const g of [g1, g2, g3]) {
      if (g && g.mine === 11 && g.theirs === 0) pickle = true;
    }

    if (won) {
      // Comeback — lost game 1 but took the match.
      if (g1 && g1.mine < g1.theirs) comebackWins++;
      // Clutch — match went to a deciding third game and you won it.
      if (g3) clutchWins++;

      // Giant Slayer — beat a team whose avg current DUPR sits well above yours.
      if (playerRating != null) {
        const oppIds = onTeam1
          ? [m.team2_player1_id, m.team2_player2_id]
          : [m.team1_player1_id, m.team1_player2_id];
        const oppRatings = oppIds
          .map((id) => (id ? opponentRatings.get(id) : undefined))
          .filter((r): r is number => r != null);
        if (oppRatings.length > 0) {
          const oppAvg = oppRatings.reduce((s, r) => s + r, 0) / oppRatings.length;
          const margin = oppAvg - playerRating;
          if (margin >= GIANT_MARGIN) {
            giantCount++;
            bestMargin = Math.max(bestMargin, margin);
          }
        }
      }
    }
  }

  return {
    pickle,
    comebackWins,
    clutchWins,
    giantSlayer: giantCount > 0 ? { count: giantCount, bestMargin } : null,
  };
}

export interface BadgeInput {
  fits: PlayerFits;
  facts: PlayerFacts;
  signals: MatchSignals;
  atPeak: boolean; // current rating sits at a meaningful career high
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace("{n}", String(n)));
const margin1 = (m: number) => (Math.round(m * 10) / 10).toFixed(1);

/** Compute the full earned set, shiniest first. */
export function computeBadges({ fits, facts, signals, atPeak }: BadgeInput): Badge[] {
  const out: Badge[] = [];
  const add = (b: Badge) => out.push(b);

  // ---- Score-story badges (the fun ones) ----
  if (signals.pickle) {
    add({ id: "the-pickle", name: "The Pickle", tagline: "Won a game 11-0 — a clean pickle", rarity: "legendary", icon: "pickle" });
  }
  if (signals.giantSlayer) {
    add({
      id: "giant-slayer",
      name: "Giant Slayer",
      tagline: `Beat a team rated ${margin1(signals.giantSlayer.bestMargin)}+ above`,
      rarity: "rare",
      icon: "slayer",
    });
  }
  if (signals.comebackWins > 0) {
    add({
      id: "comeback-kid",
      name: "Comeback Kid",
      tagline: plural(signals.comebackWins, "Won after dropping game 1", "{n}× won after dropping game 1"),
      rarity: "rare",
      icon: "comeback",
    });
  }
  if (signals.clutchWins > 0) {
    add({
      id: "clutch",
      name: "Clutch",
      tagline: plural(signals.clutchWins, "Won a deciding third game", "{n}× clutch in a deciding third"),
      rarity: "uncommon",
      icon: "target",
    });
  }

  // ---- Trajectory / form (from fits) ----
  if (atPeak) {
    add({ id: "at-their-peak", name: "At Their Peak", tagline: "Sitting at a career-high rating", rarity: "legendary", icon: "peak" });
  }
  if (fits.trend === "rising") {
    add({ id: "on-the-climb", name: "On the Climb", tagline: "Rating trending up toward a fresh peak", rarity: "uncommon", icon: "trending-up" });
  } else if (fits.trend === "sliding") {
    add({ id: "cooling-off", name: "Cooling Off", tagline: "Off a recent peak — rating sliding", rarity: "uncommon", icon: "trending-down" });
  }
  if (fits.form === "hot") {
    add({ id: "hot-hand", name: "Hot Hand", tagline: "Riding a winning streak", rarity: "rare", icon: "flame" });
  } else if (fits.form === "streaky") {
    add({ id: "coin-flip", name: "Coin Flip", tagline: "Wins and losses trading blows", rarity: "uncommon", icon: "shuffle" });
  }

  // ---- Style / format (from fits) ----
  if (fits.formatSkew === "doubles") {
    add({ id: "doubles-specialist", name: "Doubles Specialist", tagline: "Sharper with a partner", rarity: "common", icon: "users" });
  } else if (fits.formatSkew === "singles") {
    add({ id: "singles-grinder", name: "Singles Grinder", tagline: "Holds their own one-on-one", rarity: "uncommon", icon: "user" });
  } else if (fits.sample === "deep") {
    // balanced AND a deep sample = genuinely two-way, not just untested.
    add({ id: "switch-hitter", name: "Switch-Hitter", tagline: "Equally dangerous singles or doubles", rarity: "rare", icon: "swap" });
  }
  if (fits.partnerLean === "money-partner" && facts.bestPartner) {
    add({ id: "money-partner", name: "Money Partner", tagline: `Elite alongside ${facts.bestPartner.name}`, rarity: "rare", icon: "link" });
  }
  if (fits.sample === "deep") {
    add({ id: "battle-tested", name: "Battle-Tested", tagline: `${facts.totalMatches} matches on record`, rarity: "common", icon: "shield" });
  }

  return out.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
}

/* ── Collectible board (locked + progress) ───────────────────────────────────
   The curated set of badges a player can collect. Earned ones come from
   computeBadges; the rest render as locked "collect me" stickers. We exclude the
   neutral/negative descriptive tells (Cooling Off, Coin Flip, Doubles/Singles
   Specialist) — you don't aspire to *unlock* those. */
export interface CatalogBadge {
  id: string;
  name: string;
  rarity: Rarity;
  icon: BadgeIcon;
  hint: string; // how to unlock — shown when the badge is locked
}

export const BADGE_CATALOG: CatalogBadge[] = [
  { id: "the-pickle", name: "The Pickle", rarity: "legendary", icon: "pickle", hint: "Win a game 11-0 — pickle someone" },
  { id: "at-their-peak", name: "At Their Peak", rarity: "legendary", icon: "peak", hint: "Sit at a fresh career-high rating" },
  { id: "giant-slayer", name: "Giant Slayer", rarity: "rare", icon: "slayer", hint: "Beat a team rated 0.5+ above you" },
  { id: "hot-hand", name: "Hot Hand", rarity: "rare", icon: "flame", hint: "Win 5 matches in a row" },
  { id: "money-partner", name: "Money Partner", rarity: "rare", icon: "link", hint: "Win 70%+ with a regular partner" },
  { id: "comeback-kid", name: "Comeback Kid", rarity: "rare", icon: "comeback", hint: "Win a match after dropping game 1" },
  { id: "switch-hitter", name: "Switch-Hitter", rarity: "rare", icon: "swap", hint: "Stay sharp in both singles and doubles" },
  { id: "on-the-climb", name: "On the Climb", rarity: "uncommon", icon: "trending-up", hint: "Trend up toward a fresh peak" },
  { id: "clutch", name: "Clutch", rarity: "uncommon", icon: "target", hint: "Win a deciding third game" },
  { id: "battle-tested", name: "Battle-Tested", rarity: "common", icon: "shield", hint: "Log 100+ matches" },
];

export interface BoardBadge extends Badge {
  earned: boolean;
}

/** The full collectible board — every catalog badge with its earned status.
 *  Earned badges carry their live tagline; locked ones carry the unlock hint. */
export function computeBadgeBoard(input: BadgeInput): BoardBadge[] {
  const byId = new Map(computeBadges(input).map((b) => [b.id, b]));
  return BADGE_CATALOG.map((c) => {
    const earned = byId.get(c.id);
    return earned
      ? { ...earned, earned: true }
      : { id: c.id, name: c.name, rarity: c.rarity, icon: c.icon, tagline: c.hint, earned: false };
  });
}
