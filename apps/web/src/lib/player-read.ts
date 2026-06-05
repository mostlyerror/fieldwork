/**
 * Player "scouting read" copy engine — deterministic, no LLM.
 *
 * Three layers:
 *   1. Facts    — derive hard numbers from a player's record/ratings.
 *   2. Fits     — classify those facts into categorical buckets.
 *   3. Phrasing — map fits to hand-written clause variants, picked by a seed
 *                 derived from the player id so the copy is STABLE per player
 *                 but VARIED across players (no two profiles read the same).
 *
 * The Fits layer (PlayerFits) is the shared backbone: the scouting read,
 * partner verdicts, and future badges/awards all derive from it.
 */

export interface PartnerStat {
  name: string;
  wins: number;
  losses: number;
  matches: number;
}

export interface PlayerReadInput {
  playerId: string;
  name: string;
  duprDoubles: number | null;
  duprSingles: number | null;
  verified: boolean;
  /** Signed change over the recent stretch (e.g. last ~10 rating points). */
  ratingDelta: number | null;
  peak: number | null;
  low: number | null;
  doubles: { wins: number; losses: number };
  singles: { wins: number; losses: number };
  partners: PartnerStat[];
  /** Most-recent-first list of results, for form. */
  recentResults: ("W" | "L")[];
}

// ── Layer 1: Facts ──────────────────────────────────────────────────────────

export interface PlayerFacts {
  firstName: string;
  totalWins: number;
  totalLosses: number;
  totalMatches: number;
  winRate: number | null; // 0-100
  doublesWinRate: number | null;
  singlesWinRate: number | null;
  bestPartner: (PartnerStat & { winRate: number }) | null;
  delta: number | null;
  primaryRating: number | null; // doubles if present, else singles
  hotStreak: number; // leading wins in recentResults
  coldStreak: number; // leading losses
}

function rate(w: number, l: number): number | null {
  const t = w + l;
  return t === 0 ? null : Math.round((w / t) * 100);
}

export function computeFacts(i: PlayerReadInput): PlayerFacts {
  const totalWins = i.doubles.wins + i.singles.wins;
  const totalLosses = i.doubles.losses + i.singles.losses;
  const eligible = i.partners.filter((p) => p.matches >= 3);
  let bestPartner: PlayerFacts["bestPartner"] = null;
  for (const p of eligible) {
    const wr = rate(p.wins, p.losses) ?? 0;
    if (!bestPartner || wr > bestPartner.winRate || (wr === bestPartner.winRate && p.matches > bestPartner.matches)) {
      bestPartner = { ...p, winRate: wr };
    }
  }
  let hot = 0;
  for (const r of i.recentResults) { if (r === "W") hot++; else break; }
  let cold = 0;
  for (const r of i.recentResults) { if (r === "L") cold++; else break; }

  return {
    firstName: i.name.trim().split(/\s+/)[0] || i.name,
    totalWins,
    totalLosses,
    totalMatches: totalWins + totalLosses,
    winRate: rate(totalWins, totalLosses),
    doublesWinRate: rate(i.doubles.wins, i.doubles.losses),
    singlesWinRate: rate(i.singles.wins, i.singles.losses),
    bestPartner,
    delta: i.ratingDelta,
    primaryRating: i.duprDoubles ?? i.duprSingles,
    hotStreak: hot,
    coldStreak: cold,
  };
}

// ── Layer 2: Fits ───────────────────────────────────────────────────────────

export type Sample = "thin" | "moderate" | "deep";
export type Trend = "rising" | "sliding" | "flat";
export type Form = "hot" | "cold" | "streaky" | "even";
export type FormatSkew = "doubles" | "singles" | "balanced";
export type PartnerLean = "money-partner" | "no-standout";
export type RecordShape = "winning" | "even" | "losing";

export interface PlayerFits {
  sample: Sample;
  trend: Trend;
  form: Form;
  formatSkew: FormatSkew;
  partnerLean: PartnerLean;
  recordShape: RecordShape;
}

export function classifyFits(i: PlayerReadInput, f: PlayerFacts): PlayerFits {
  const sample: Sample = f.totalMatches < 8 ? "thin" : f.totalMatches <= 25 ? "moderate" : "deep";

  const d = f.delta;
  const trend: Trend = d == null ? "flat" : d >= 0.1 ? "rising" : d <= -0.1 ? "sliding" : "flat";

  let form: Form = "even";
  if (f.hotStreak >= 3) form = "hot";
  else if (f.coldStreak >= 3) form = "cold";
  else if (i.recentResults.length >= 4) {
    const last4 = i.recentResults.slice(0, 4).join("");
    form = /WLWL|LWLW/.test(last4) ? "streaky" : "even";
  }

  // Format skew needs a real sample on BOTH sides and a meaningful gap.
  let formatSkew: FormatSkew = "balanced";
  const dwr = f.doublesWinRate;
  const swr = f.singlesWinRate;
  const dN = i.doubles.wins + i.doubles.losses;
  const sN = i.singles.wins + i.singles.losses;
  if (dN >= 3 && sN >= 3 && dwr != null && swr != null) {
    if (dwr - swr >= 18) formatSkew = "doubles";
    else if (swr - dwr >= 18) formatSkew = "singles";
  } else if (dN >= 3 && sN === 0) formatSkew = "doubles";
  else if (sN >= 3 && dN === 0) formatSkew = "singles";

  // A "money partner" lifts win-rate well above the player's baseline.
  const base = f.winRate ?? 50;
  const partnerLean: PartnerLean =
    f.bestPartner && f.bestPartner.matches >= 3 && f.bestPartner.winRate - base >= 15 && f.bestPartner.winRate >= 60
      ? "money-partner"
      : "no-standout";

  const wr = f.winRate ?? 50;
  const recordShape: RecordShape = wr >= 55 ? "winning" : wr <= 45 ? "losing" : "even";

  return { sample, trend, form, formatSkew, partnerLean, recordShape };
}

// ── Layer 3: Phrasing ───────────────────────────────────────────────────────

/** djb2 string hash → stable non-negative int. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic variant pick: stable per (playerId, slot), varied across players. */
function pick<T>(variants: T[], seed: number, slot: number): T {
  return variants[(seed + slot * 2654435761) % variants.length];
}

const fmt = (n: number | null, d = 2) => (n == null ? "—" : n.toFixed(d));
const ver = (v: boolean) => (v ? ", verified" : " (unverified)");

type Clause = (f: PlayerFacts, i: PlayerReadInput) => string;

const OPENING: Record<Trend, Clause[]> = {
  sliding: [
    (f, i) => `${fmt(f.primaryRating)} doubles${ver(i.verified)}, but sliding — down ${fmt(Math.abs(f.delta ?? 0))} off a ${fmt(i.peak)} peak.`,
    (f, i) => `The rating reads ${fmt(f.primaryRating)}${ver(i.verified)}, but it's been slipping (${fmt(f.delta)} lately, off a ${fmt(i.peak)} high).`,
    (f, i) => `${fmt(f.primaryRating)} doubles${ver(i.verified)} and trending the wrong way — ${fmt(f.delta)} from the ${fmt(i.peak)} top.`,
  ],
  rising: [
    (f, i) => `${fmt(f.primaryRating)} doubles${ver(i.verified)} and climbing — ${fmt(f.delta)} to a fresh ${fmt(i.peak)}.`,
    (f, i) => `On the way up: ${fmt(f.primaryRating)} doubles${ver(i.verified)}, ${fmt(f.delta)} over the last stretch.`,
    (f, i) => `${fmt(f.primaryRating)} doubles${ver(i.verified)}, trending up (${fmt(f.delta)}) and still rising.`,
  ],
  flat: [
    (f, i) => `${fmt(f.primaryRating)} doubles${ver(i.verified)}, steady around the ${fmt(f.primaryRating, 1)} mark.`,
    (f, i) => `Holding at ${fmt(f.primaryRating)} doubles${ver(i.verified)} — not much movement lately.`,
    (f, i) => `${fmt(f.primaryRating)} doubles${ver(i.verified)}, flat for a while now.`,
  ],
};

const RECORD: Record<FormatSkew, Clause[]> = {
  doubles: [
    (f) => `The ${f.winRate}% over ${f.totalMatches} hides the split: a ${f.doublesWinRate}% doubles player, a grind in singles (${f.singlesWinRate}%).`,
    (f) => `Lethal in doubles (${f.doublesWinRate}%), exposed the moment it's singles (${f.singlesWinRate}%).`,
    (f) => `Doubles is the game — ${f.doublesWinRate}% — while singles tells the real story at ${f.singlesWinRate}%.`,
  ],
  singles: [
    (f) => `A singles specialist: ${f.singlesWinRate}% one-on-one, but only ${f.doublesWinRate}% with a partner.`,
    (f) => `Dangerous in singles (${f.singlesWinRate}%); the doubles record (${f.doublesWinRate}%) is the soft spot.`,
    (f) => `Built for singles — ${f.singlesWinRate}% — and noticeably cooler in doubles (${f.doublesWinRate}%).`,
  ],
  balanced: [
    (f) => `${f.totalWins}–${f.totalLosses} overall (${f.winRate}%), and it travels — both formats hold up.`,
    (f) => `A balanced ${f.winRate}% across ${f.totalMatches} matches, format no object.`,
    (f) => `${f.winRate}% either way — singles or doubles, much the same player.`,
  ],
};

const PARTNER: Clause[] = [
  (f) => `Pair them with ${f.bestPartner!.name} and it clicks — ${f.bestPartner!.wins}–${f.bestPartner!.losses} together.`,
  (f) => `${f.bestPartner!.name} is the difference-maker: ${f.bestPartner!.winRate}% as a team.`,
  (f) => `Best alongside ${f.bestPartner!.name} (${f.bestPartner!.wins}–${f.bestPartner!.losses}); split them and the edge shifts.`,
];

const TACTICAL: Record<FormatSkew, string[]> = {
  doubles: ["Force singles, get on them early.", "Take them out of doubles and the math flips.", "Push the singles matchup."],
  singles: ["Make them play doubles.", "Draw them into a partner format.", "Force the doubles draw."],
  balanced: [],
};

const THIN: Clause[] = [
  (f) => `${f.totalWins}–${f.totalLosses} across ${f.totalMatches} tracked match${f.totalMatches === 1 ? "" : "es"} — too early to scout hard.`,
  (f) => `Only ${f.totalMatches} match${f.totalMatches === 1 ? "" : "es"} on record so far (${f.totalWins}–${f.totalLosses}); read it light.`,
  (f) => `A thin file — ${f.totalWins}–${f.totalLosses} over ${f.totalMatches} — not enough yet to call.`,
];

export interface PlayerRead {
  read: string;
  partnerVerdict: string | null; // e.g. "Elite duo", "Still gelling"
  formLabel: string; // e.g. "Won last 4", "Streaky"
  fits: PlayerFits;
  facts: PlayerFacts;
}

/** Build the deterministic scouting read for a player. */
export function buildPlayerRead(input: PlayerReadInput): PlayerRead {
  const facts = computeFacts(input);
  const fits = classifyFits(input, facts);
  const seed = hash(input.playerId);

  const clauses: string[] = [pick(OPENING[fits.trend], seed, 0)(facts, input)];

  if (fits.sample === "thin") {
    clauses.push(pick(THIN, seed, 1)(facts, input));
  } else {
    clauses.push(pick(RECORD[fits.formatSkew], seed, 1)(facts, input));
    if (fits.partnerLean === "money-partner" && facts.bestPartner) {
      clauses.push(pick(PARTNER, seed, 2)(facts, input));
    }
    // A tactical kicker only when there's a clear format edge AND enough data.
    if (fits.sample === "deep" && fits.formatSkew !== "balanced") {
      const t = TACTICAL[fits.formatSkew];
      if (t.length) clauses.push(pick(t, seed, 3));
    }
  }

  return {
    read: clauses.join(" "),
    partnerVerdict: partnerVerdict(facts),
    formLabel: formLabel(facts, fits),
    fits,
    facts,
  };
}

function partnerVerdict(f: PlayerFacts): string | null {
  const bp = f.bestPartner;
  if (!bp || bp.matches < 3) return null;
  if (bp.winRate >= 75) return "Elite duo";
  if (bp.winRate >= 55) return "Reliable pairing";
  if (bp.winRate >= 40) return "Still gelling";
  return "Snakebit together";
}

function formLabel(f: PlayerFacts, fits: PlayerFits): string {
  if (fits.form === "hot") return `Won last ${f.hotStreak}`;
  if (fits.form === "cold") return `Lost last ${f.coldStreak}`;
  if (fits.form === "streaky") return "Streaky";
  return "Even form";
}
