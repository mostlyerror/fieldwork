/**
 * DUPR discovery pass — name-search players the pull queue can't reach.
 *
 * Verified players WITH a dupr_id get their ratings refreshed by the unified
 * per-player pull (match-history.ts pulls their profile alongside history), so
 * this pass covers the rest: players with no dupr_id yet (fuzzy name matching
 * to find them) and id-holders the queue excludes (dupr_verified ≠ true).
 * All DUPR HTTP goes through utils/dupr-client.ts (auth/pacing/budget).
 */
import { supabase } from "./supabase.js";
import {
  getDuprToken,
  duprSearch,
  parseRatings,
  DuprAuthFailed,
  DuprBudgetExhausted,
  DuprCircuitOpen,
  type DuprSearchHit,
} from "./dupr-client.js";

const BATCH_SIZE = 50;
const STALE_DAYS = 7;

function normalizeCity(location: string | null): string {
  if (!location) return "";
  return location.toLowerCase().replace(/[,\s]+/g, " ").trim();
}

function normalizeGender(g: string | null | undefined): string | null {
  if (!g) return null;
  const lower = g.toLowerCase();
  if (lower === "male" || lower === "m" || lower === "men") return "M";
  if (lower === "female" || lower === "f" || lower === "women") return "F";
  return null;
}

function pickBestMatch(
  results: DuprSearchHit[],
  playerName: string,
  playerLocation: string | null,
  playerGender: string | null,
): DuprSearchHit | null {
  if (results.length === 0) return null;

  const nameLower = playerName.toLowerCase().trim();
  const locationNorm = normalizeCity(playerLocation);
  const genderNorm = normalizeGender(playerGender);

  // Pre-filter: reject candidates with wrong gender
  const candidates = results.filter((r) => {
    if (!r.fullName) return false;
    const rGender = normalizeGender(r.gender);
    if (genderNorm && rGender && genderNorm !== rGender) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Exact name + location match is the strongest signal
  if (locationNorm) {
    const locMatch = candidates.find(
      (r) =>
        r.fullName.toLowerCase().trim() === nameLower &&
        normalizeCity(r.shortAddress ?? null).includes(locationNorm.split(" ")[0])
    );
    if (locMatch) return locMatch;
  }

  // Exact name match — but only accept if there's a single exact match
  const nameMatches = candidates.filter(
    (r) => r.fullName.toLowerCase().trim() === nameLower
  );
  if (nameMatches.length === 1) return nameMatches[0];

  // Multiple people with the same name and no location to disambiguate — skip
  return null;
}

interface StalePlayer {
  id: string;
  name: string;
  location: string | null;
  gender: string | null;
  dupr_doubles: number | null;
  dupr_id: string | null;
}

/**
 * Players the unified pull queue does NOT cover: no dupr_id yet (discovery),
 * or id known but dupr_verified ≠ true (the queue gates on verified).
 */
async function getStalePlayers(limit: number): Promise<StalePlayer[]> {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - STALE_DAYS);

  const { data, error } = await supabase
    .from("players")
    .select("id, name, location, gender, dupr_doubles, dupr_id")
    .or("dupr_id.is.null,dupr_verified.not.is.true")
    .or(`dupr_last_checked.is.null,dupr_last_checked.lt.${staleDate.toISOString()}`)
    .order("dupr_last_checked", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error("[dupr-enrich] Error fetching stale players:", error);
    return [];
  }

  return data ?? [];
}

function isRunAbort(err: unknown): boolean {
  return (
    err instanceof DuprBudgetExhausted ||
    err instanceof DuprCircuitOpen ||
    err instanceof DuprAuthFailed
  );
}

export async function enrichDuprRatings(): Promise<{
  checked: number;
  updated: number;
  failed: number;
}> {
  console.log("[dupr-enrich] Starting DUPR discovery/enrichment...");

  if (!(await getDuprToken())) {
    return { checked: 0, updated: 0, failed: 0 };
  }

  const players = await getStalePlayers(BATCH_SIZE);
  console.log(`[dupr-enrich] Found ${players.length} players needing DUPR refresh`);

  let checked = 0;
  let updated = 0;
  let failed = 0;

  for (const player of players) {
    try {
      let match: DuprSearchHit | null = null;

      if (player.dupr_id) {
        // Direct lookup by DUPR ID — no ambiguity
        const results = await duprSearch(player.dupr_id, 5);
        match = results.find((r) => r.duprId === player.dupr_id) ?? results[0] ?? null;
      } else {
        // Name-based search with fuzzy matching
        const results = await duprSearch(player.name);
        match = pickBestMatch(results, player.name, player.location, player.gender);
      }

      checked++;
      const now = new Date().toISOString();
      const r = parseRatings(match?.ratings);

      if (match && r.doubles != null) {
        const { error } = await supabase
          .from("players")
          .update({
            dupr_doubles: r.doubles,
            dupr_doubles_verified: r.doublesVerified,
            dupr_doubles_provisional: r.doublesProvisional,
            dupr_singles: r.singles,
            dupr_singles_verified: r.singlesVerified,
            dupr_singles_provisional: r.singlesProvisional,
            dupr_verified: !r.doublesProvisional,
            dupr_last_checked: now,
            ...(match.duprId ? { dupr_id: match.duprId } : {}),
            // Cache DUPR's numeric id so the first real pull skips its search.
            dupr_numeric_id: match.id,
          })
          .eq("id", player.id);

        if (error) {
          console.error(`[dupr-enrich] Update failed for "${player.name}":`, error);
          failed++;
        } else {
          const delta = player.dupr_doubles
            ? (r.doubles - player.dupr_doubles).toFixed(2)
            : "new";
          const via = player.dupr_id ? "ID" : "name";
          console.log(`[dupr-enrich] ✓ ${player.name}: ${r.doubles} (Δ ${delta}, via ${via})`);
          updated++;
        }
      } else {
        await supabase
          .from("players")
          .update({ dupr_last_checked: now })
          .eq("id", player.id);
      }
    } catch (err) {
      if (isRunAbort(err)) {
        console.warn(`[dupr-enrich] Stopping run early: ${(err as Error).message}`);
        break;
      }
      console.error(`[dupr-enrich] Error for "${player.name}":`, err);
      failed++;
    }
  }

  console.log(`[dupr-enrich] Done. Checked: ${checked}, Updated: ${updated}, Failed: ${failed}`);

  return { checked, updated, failed };
}
