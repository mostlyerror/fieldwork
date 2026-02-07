/**
 * Pickleball Den scraper
 *
 * Fetches active tournaments from Pickleball Den's public JSON API.
 * The endpoint returns newline-delimited JSON (one JSON object per line).
 * No auth or browser required — plain fetch().
 */

import { hashContent } from "../utils/hash.js";
import { distanceMiles, HOUSTON_LAT, HOUSTON_LNG, MAX_DISTANCE_MILES } from "../utils/geo.js";
import type { ScrapedTournament } from "../types.js";

const SOURCE_PLATFORM = "pickleball_den";
const API_URL =
  "https://app.pickleballden.com/activeTournamentQuery?vendorCode=y98IU9K";

interface DenTournament {
  name: string;
  startDate: string; // MM-DD-YYYY
  endDate: string;   // MM-DD-YYYY
  locationName: string;
  locationGPS: string; // "lat, lng"
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  tournamentFee: string; // e.g. "$50"
  website: string;
  registrationClose: string; // MM-DD-YYYY
}

/**
 * Convert MM-DD-YYYY to YYYY-MM-DD.
 */
function convertDate(mmddyyyy: string): string {
  const [mm, dd, yyyy] = mmddyyyy.split("-");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse the "lat, lng" string from locationGPS.
 */
function parseGPS(gps: string): { lat: number; lng: number } | null {
  if (!gps) return null;
  const parts = gps.split(",").map((s) => s.trim());
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

/**
 * Parse entry fee from strings like "$50", "$25.00", or "Free".
 */
function parseEntryFee(fee: string): number | undefined {
  if (!fee) return undefined;
  const cleaned = fee.replace(/[$,]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

// Parse --limit N from CLI args
function getLimit(): number | undefined {
  const idx = process.argv.indexOf("--limit");
  if (idx !== -1 && process.argv[idx + 1]) {
    const n = parseInt(process.argv[idx + 1], 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return undefined;
}

/**
 * Main scrape function for Pickleball Den.
 */
export async function scrape(): Promise<ScrapedTournament[]> {
  const limit = getLimit();
  console.log(
    `[pickleball_den] Starting scrape...${limit ? ` (limit: ${limit})` : ""}`
  );

  const res = await fetch(API_URL);
  if (!res.ok) {
    throw new Error(
      `[pickleball_den] API returned ${res.status}: ${res.statusText}`
    );
  }

  const text = await res.text();
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  console.log(`[pickleball_den] API returned ${lines.length} tournaments`);

  const tournaments: ScrapedTournament[] = [];

  for (const line of lines) {
    let raw: DenTournament;
    try {
      raw = JSON.parse(line);
    } catch {
      console.warn("[pickleball_den] Skipping unparseable line");
      continue;
    }

    // Filter by distance to Houston
    const gps = parseGPS(raw.locationGPS);
    if (gps) {
      const dist = distanceMiles(HOUSTON_LAT, HOUSTON_LNG, gps.lat, gps.lng);
      if (dist > MAX_DISTANCE_MILES) {
        continue;
      }
    } else {
      // No GPS data — skip since we can't verify it's near Houston
      console.log(
        `[pickleball_den] SKIP "${raw.name}" — no GPS coordinates`
      );
      continue;
    }

    // Derive registration status from registrationClose date
    let registrationStatus = "open";
    if (raw.registrationClose) {
      try {
        const closeDate = new Date(convertDate(raw.registrationClose));
        if (closeDate < new Date()) {
          registrationStatus = "closed";
        }
      } catch {
        // Keep as open if we can't parse the date
      }
    }

    const locationAddress = [
      raw.streetAddress,
      `${raw.city}, ${raw.state} ${raw.postalCode}`,
    ]
      .filter(Boolean)
      .join(", ");

    const tournament: ScrapedTournament = {
      name: raw.name,
      dateStart: convertDate(raw.startDate),
      dateEnd: convertDate(raw.endDate),
      locationName: raw.locationName,
      locationAddress: locationAddress || undefined,
      latitude: gps.lat,
      longitude: gps.lng,
      skillLevels: [],
      entryFee: parseEntryFee(raw.tournamentFee),
      registrationUrl: raw.website,
      registrationStatus,
      sourcePlatform: SOURCE_PLATFORM,
      sourceUrl: raw.website,
      rawPageHash: hashContent(line),
    };

    tournaments.push(tournament);
    console.log(
      `[pickleball_den] OK "${raw.name}" on ${tournament.dateStart} at ${raw.locationName}`
    );

    if (limit && tournaments.length >= limit) {
      console.log(`[pickleball_den] Reached limit of ${limit}`);
      break;
    }
  }

  console.log(
    `[pickleball_den] Scrape complete. ${tournaments.length} Houston-area tournaments found.`
  );
  return tournaments;
}

// Allow running this scraper directly
async function main() {
  const { startRun, completeRun, failRun } = await import("../utils/logger.js");
  const { upsertTournaments } = await import("../utils/upsert.js");

  const run = await startRun(SOURCE_PLATFORM);
  try {
    const tournaments = await scrape();
    const stats = await upsertTournaments(tournaments);
    await completeRun(run, {
      tournamentsFound: tournaments.length,
      ...stats,
    });
  } catch (err) {
    await failRun(run, err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

const isDirectRun =
  process.argv[1]?.endsWith("pickleballden.ts") ||
  process.argv[1]?.endsWith("pickleballden.js");

if (isDirectRun) {
  main();
}
