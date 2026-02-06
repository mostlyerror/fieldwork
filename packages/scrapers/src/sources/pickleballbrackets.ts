/**
 * PickleballBrackets / PickleballTournaments scraper
 *
 * PickleballBrackets.com now redirects to PickleballTournaments.com.
 * The search page uses Next.js Server Actions (not a REST API), so Playwright
 * is required to render the JS-heavy search results.
 *
 * Strategy:
 * 1. Hit the search API for a quick list of Houston tournaments
 * 2. Navigate to the search page with Houston coords via Playwright
 * 3. Wait for tournament cards to render
 * 4. Extract slugs/links from listing cards
 * 5. Visit each tournament detail page for full data
 * 6. Parse the RSC payload embedded in the page for structured data
 */

import { chromium, type Browser, type Page } from "playwright";
import { hashContent } from "../utils/hash.js";
import { parseRscTournamentData } from "../utils/parse-rsc.js";
import type { ScrapedTournament, ScraperSource } from "../types.js";

const SOURCE_PLATFORM = "pickleballbrackets";
const BASE_URL = "https://pickleballtournaments.com";
const SEARCH_URL = `${BASE_URL}/search?loc=Houston%2C+TX&lat=29.7604&lng=-95.3698&zoom=9`;
const SEARCH_API_URL = `${BASE_URL}/api/v1/search`;

// Houston center coords for distance filtering
const HOUSTON_LAT = 29.7604;
const HOUSTON_LNG = -95.3698;
const MAX_DISTANCE_MILES = 50;

interface SearchApiTournament {
  TournamentID: string;
  Title: string;
  slug: string;
  DetailsURL: string;
  TourneyFromDate: string;
  TourneyToDate: string;
  LocationCity: string;
  LocationState: string;
  RegistrationDateOpen: string;
  RegistrationDateClosed: string;
}

/**
 * Calculate distance between two lat/lng points in miles using Haversine formula.
 */
function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Try the text search API first for quick discovery.
 * Returns tournament slugs found via the API.
 */
async function fetchFromSearchApi(): Promise<string[]> {
  const slugs: string[] = [];
  const queries = ["houston", "sugar land", "katy", "conroe", "cypress"];

  for (const query of queries) {
    try {
      const res = await fetch(`${SEARCH_API_URL}?query=${encodeURIComponent(query)}`);
      if (!res.ok) continue;

      const json = await res.json();
      const tourneys = json?.data?.tourneys ?? [];
      for (const t of tourneys) {
        if (t.slug && !slugs.includes(t.slug)) {
          slugs.push(t.slug);
        }
      }
    } catch (err) {
      console.error(`[pickleballbrackets] API search for "${query}" failed:`, err);
    }
  }

  console.log(
    `[pickleballbrackets] API search found ${slugs.length} tournament slugs`
  );
  return slugs;
}

/**
 * Use Playwright to load the search page and extract tournament slugs
 * from the rendered cards.
 */
async function fetchSlugsFromSearchPage(page: Page): Promise<string[]> {
  console.log(`[pickleballbrackets] Loading search page: ${SEARCH_URL}`);
  await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });

  // Wait for tournament cards to appear. The search results are rendered
  // client-side after a Server Action call. We look for links to /tournaments/.
  try {
    await page.waitForSelector('a[href*="/tournaments/"]', { timeout: 30000 });
  } catch {
    console.warn(
      "[pickleballbrackets] No tournament links found on search page within timeout"
    );
    return [];
  }

  // Give extra time for all results to load
  await page.waitForTimeout(3000);

  // Scroll down to trigger any lazy-loaded content
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) {
      window.scrollBy(0, window.innerHeight);
      await new Promise((r) => setTimeout(r, 800));
    }
  });

  await page.waitForTimeout(2000);

  // Extract all tournament slugs from links
  const slugs = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/tournaments/"]');
    const found = new Set<string>();
    for (const link of links) {
      const href = link.getAttribute("href");
      if (!href) continue;
      const match = href.match(/\/tournaments\/([^/?#]+)/);
      if (match && match[1]) {
        // Filter out generic navigation links
        const slug = match[1];
        if (
          slug !== "search" &&
          slug !== "create" &&
          !slug.startsWith("api")
        ) {
          found.add(slug);
        }
      }
    }
    return Array.from(found);
  });

  console.log(
    `[pickleballbrackets] Search page found ${slugs.length} tournament slugs`
  );
  return slugs;
}

/**
 * Parse a tournament detail page for full data.
 * The page contains Next.js RSC payloads in self.__next_f.push() calls
 * that have structured tournament data.
 */
async function parseTournamentDetailPage(
  page: Page,
  slug: string
): Promise<ScrapedTournament | null> {
  const url = `${BASE_URL}/tournaments/${slug}`;
  console.log(`[pickleballbrackets] Scraping: ${slug}`);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    // Wait just long enough for RSC scripts to be in the DOM
    await page.waitForTimeout(1500);

    const pageContent = await page.content();
    const contentHash = hashContent(pageContent);

    // Extract structured fields from the RSC payload embedded in the page
    const rscData = parseRscTournamentData(pageContent);

    const title = rscData?.title ?? null;
    const dateStart = rscData?.dateStart ?? null;
    const dateEnd = rscData?.dateEnd ?? null;
    const venueName = rscData?.venueName ?? null;
    const street = rscData?.street ?? null;
    const cityStateZip = rscData?.cityStateZip ?? null;
    const status = rscData?.status ?? null;
    const latStr = rscData?.latitude ?? null;
    const lngStr = rscData?.longitude ?? null;
    const venueFromLoc = rscData?.venue ?? null;
    const city = rscData?.city ?? null;
    const stateAbbr = rscData?.stateAbbreviation ?? null;
    const priceNum = rscData?.costRegistrationCurrent ?? null;

    const pageTitle = title || (await page.title()) || null;

    if (!pageTitle) {
      console.warn(`[pickleballbrackets] No title for ${slug}, skipping`);
      return null;
    }

    // Parse dates
    let parsedDateStart: string | undefined;
    let parsedDateEnd: string | undefined;

    if (dateStart) {
      parsedDateStart = dateStart.split("T")[0];
    }
    if (dateEnd) {
      parsedDateEnd = dateEnd.split("T")[0];
    }

    if (!parsedDateStart) {
      console.warn(
        `[pickleballbrackets] No date for "${pageTitle}", skipping`
      );
      return null;
    }

    // Parse lat/lng and filter by distance
    const latitude = latStr ? parseFloat(latStr) : undefined;
    const longitude = lngStr ? parseFloat(lngStr) : undefined;

    if (latitude && longitude) {
      const dist = distanceMiles(HOUSTON_LAT, HOUSTON_LNG, latitude, longitude);
      if (dist > MAX_DISTANCE_MILES) {
        console.log(
          `[pickleballbrackets] SKIP "${pageTitle}" — ${dist.toFixed(0)}mi from Houston (${city}, ${stateAbbr})`
        );
        return null;
      }
    }

    // Map status field
    let registrationStatus = "open";
    if (status === "reg-closed" || status === "closed") {
      registrationStatus = "closed";
    } else if (status === "reg-open" || status === "price") {
      registrationStatus = "open";
    }

    const locationName = venueFromLoc || venueName || cityStateZip || "Unknown";
    const locationAddress = street && cityStateZip
      ? `${street}, ${cityStateZip}`
      : cityStateZip || undefined;

    const tournament: ScrapedTournament = {
      name: pageTitle,
      dateStart: parsedDateStart,
      dateEnd: parsedDateEnd,
      locationName,
      locationAddress,
      latitude,
      longitude,
      skillLevels: [],
      format: undefined,
      entryFee: priceNum || undefined,
      registrationUrl: url,
      registrationStatus,
      sourcePlatform: SOURCE_PLATFORM,
      sourceUrl: url,
      description:
        (await page.evaluate(
          () =>
            document
              .querySelector('meta[name="description"]')
              ?.getAttribute("content") || null
        )) || undefined,
      rawPageHash: contentHash,
    };

    console.log(
      `[pickleballbrackets] OK "${pageTitle}" on ${parsedDateStart} at ${locationName}`
    );
    return tournament;
  } catch (err) {
    console.error(`[pickleballbrackets] Error parsing ${slug}:`, err);
    return null;
  }
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
 * Main scrape function for PickleballBrackets/PickleballTournaments.
 */
export async function scrape(): Promise<ScrapedTournament[]> {
  const limit = getLimit();
  console.log(`[pickleballbrackets] Starting scrape...${limit ? ` (limit: ${limit})` : ""}`);

  let browser: Browser | null = null;
  const tournaments: ScrapedTournament[] = [];

  try {
    // Step 1: Get slugs from the text search API (quick, no browser needed)
    const apiSlugs = await fetchFromSearchApi();

    // Step 2: Launch browser and get slugs from the search page
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    const pageSlugs = await fetchSlugsFromSearchPage(page);

    // Merge slugs, deduplicated
    let allSlugs = [...new Set([...apiSlugs, ...pageSlugs])];
    if (limit) {
      console.log(
        `[pickleballbrackets] ${allSlugs.length} slugs found, limiting to ${limit}`
      );
      allSlugs = allSlugs.slice(0, limit);
    } else {
      console.log(
        `[pickleballbrackets] Total unique slugs to scrape: ${allSlugs.length}`
      );
    }

    // Step 3: Visit each detail page and extract data
    for (const slug of allSlugs) {
      try {
        const tournament = await parseTournamentDetailPage(page, slug);
        if (tournament) {
          tournaments.push(tournament);
        }
      } catch (err) {
        console.error(
          `[pickleballbrackets] Error scraping tournament "${slug}":`,
          err
        );
        // Continue to next tournament
      }

      // Small delay between requests
      await page.waitForTimeout(500 + Math.random() * 500);
    }

    await context.close();
  } catch (err) {
    console.error("[pickleballbrackets] Fatal scraper error:", err);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log(
    `[pickleballbrackets] Scrape complete. ${tournaments.length} tournaments found.`
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
  process.argv[1]?.endsWith("pickleballbrackets.ts") ||
  process.argv[1]?.endsWith("pickleballbrackets.js");

if (isDirectRun) {
  main();
}
