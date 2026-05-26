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
import { distanceMiles, HOUSTON_LAT, HOUSTON_LNG, MAX_DISTANCE_MILES } from "../utils/geo.js";
import { parseEventName } from "../utils/parse-event-name.js";
import type { ScrapedTournament, ScrapedEvent, ScrapedPlayer, ScraperSource } from "../types.js";

const SOURCE_PLATFORM = "pickleballbrackets";
const BASE_URL = "https://pickleballtournaments.com";
const SEARCH_URL = `${BASE_URL}/search?loc=Houston%2C+TX&lat=29.7604&lng=-95.3698&zoom=9`;
const SEARCH_API_URL = `${BASE_URL}/api/v1/search`;

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
 * PBB eventPlayers API response shape.
 */
interface PbbPlayerResponse {
  playerFullName: string;
  partnerFullName: string;
  playerSkill: string;
  partnerSkill: string;
  playerDuprActive: boolean;
  partnerDuprActive: boolean;
  isOnWaitlist: boolean;
  isRegistered: boolean;
  // Identity fields
  playerId: string;
  playerSlug: string;
  playerCityState: string;
  playerGender: string;
  partnerId: string;
  partnerSlug: string;
}

/**
 * Scrape events from a tournament's /events page.
 *
 * PBB DOM structure (as of Feb 2026):
 *   Category header:  <div class="rounded-lg bg-blue-600 ...">Mens Doubles (Amateur)</div>
 *   Event card top:   <div class="... rounded-t-lg bg-blue-100 p-3">
 *     Event name:       <div class="text-base font-bold text-gray-900">Men's Doubles (3.0)</div>
 *     Skill range:      <div class="text-sm text-gray-600">3.000 – 3.499</div>
 *     Format/Max:       "Round-Robin" | "Max Teams: 20"
 *   Event card bottom: <div class="... rounded-b-lg bg-white ...">
 *     Registered count: button text "Registered" followed by <span>9</span>
 *
 * Player data: Clicking an event's "All" button fires a fetch to
 *   /tournaments/api/eventPlayers?activityId={uuid}&activitySplitId=null
 * which returns JSON with player names, skill levels, and DUPR status.
 */
async function scrapeEvents(page: Page, slug: string): Promise<ScrapedEvent[]> {
  const eventsUrl = `${BASE_URL}/tournaments/${slug}/events`;
  const events: ScrapedEvent[] = [];

  try {
    await page.goto(eventsUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Wait for event cards (blue header sections) to render
    const hasEvents = await page
      .waitForSelector('.bg-blue-100', { timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    if (!hasEvents) {
      console.log(`[pickleballbrackets] No events found on ${eventsUrl}`);
      return [];
    }

    // Set up listener to capture eventPlayers API responses
    const playersByActivityId = new Map<string, PbbPlayerResponse[]>();
    page.on("response", async (res) => {
      const resUrl = res.url();
      if (resUrl.includes("eventPlayers")) {
        try {
          const json = await res.json();
          const urlObj = new URL(resUrl);
          const activityId = urlObj.searchParams.get("activityId") || "";
          if (activityId) {
            playersByActivityId.set(activityId, json);
          }
        } catch {}
      }
    });

    // Extract event data from the DOM and find which "All" buttons to click
    const rawEvents = await page.evaluate(() => {
      const results: Array<{
        name: string;
        skillRange: string;
        format: string;
        maxCapacity: number | null;
        registeredCount: number;
        allButtonIndex: number; // index into all "All" buttons on the page
      }> = [];

      const blueCards = document.querySelectorAll('div.bg-blue-100');
      // Collect all "All" buttons on the page for index reference
      const allAllButtons = Array.from(document.querySelectorAll('button')).filter(
        btn => /^All\s*\d+/.test(btn.textContent?.trim() ?? '')
      );
      let buttonIdx = 0;

      for (const card of blueCards) {
        const nameEl = card.querySelector('.text-base.font-bold.text-gray-900');
        const name = nameEl?.textContent?.trim();
        if (!name) continue;

        const skillRangeEl = Array.from(card.querySelectorAll('.text-sm.text-gray-600')).find(el => {
          const text = el.textContent?.trim() ?? '';
          return /[\d.]/.test(text) && (text.includes('–') || text.includes('-') || text.includes('+') || text.toLowerCase().includes('unranked'));
        });
        const skillRange = skillRangeEl?.textContent?.trim() ?? '';

        let format = '';
        let maxCapacity: number | null = null;
        const infoTexts = card.querySelectorAll('.text-gray-900');
        for (const el of infoTexts) {
          const text = el.textContent?.trim() ?? '';
          if (text.startsWith('Max Teams:') || text.startsWith('Max Players:')) {
            const num = parseInt(text.replace(/\D/g, ''), 10);
            if (!isNaN(num)) maxCapacity = num;
          } else if (text && text !== name) {
            if (['Round-Robin', 'Double Elim', 'Single Elim', 'Pool Play'].some(f => text.includes(f)) || text.includes('Robin') || text.includes('Bracket') || text.includes('Elim')) {
              format = text;
            }
          }
        }

        let registeredCount = 0;
        let allBtnIdx = -1;
        const whiteCard = card.nextElementSibling;
        if (whiteCard) {
          const buttons = whiteCard.querySelectorAll('button');
          for (const btn of buttons) {
            const btnText = btn.textContent ?? '';
            if (btnText.includes('Registered')) {
              const spans = btn.querySelectorAll('span.rounded-full');
              for (const span of spans) {
                const num = parseInt(span.textContent?.trim() ?? '', 10);
                if (!isNaN(num)) {
                  registeredCount = num;
                  break;
                }
              }
            }
            // Find the "All N" button for this event
            const allMatch = btnText.trim().match(/^All\s*(\d+)/);
            if (allMatch) {
              const idx = allAllButtons.indexOf(btn);
              if (idx !== -1) allBtnIdx = idx;
            }
          }
        }

        results.push({ name, skillRange, format, maxCapacity, registeredCount, allButtonIndex: allBtnIdx });
      }

      return results;
    });

    // Click each "All" button that has registered players to trigger the eventPlayers API
    // We use locator-based clicking to avoid stale element handles
    const allButtons = await page.locator('button').all();
    const allButtonLocators: Array<{ index: number; count: number }> = [];
    for (let i = 0; i < allButtons.length; i++) {
      const text = await allButtons[i].textContent();
      const match = text?.trim().match(/^All\s*(\d+)/);
      if (match) {
        allButtonLocators.push({ index: i, count: parseInt(match[1]) });
      }
    }

    // Click buttons with registered players (count > 0)
    // Track the order of activityIds as they arrive
    const activityIdOrder: string[] = [];
    page.on("response", async (res) => {
      const resUrl = res.url();
      if (resUrl.includes("eventPlayers")) {
        const urlObj = new URL(resUrl);
        const activityId = urlObj.searchParams.get("activityId") || "";
        if (activityId && !activityIdOrder.includes(activityId)) {
          activityIdOrder.push(activityId);
        }
      }
    });

    // Build a map: allButtonIndex → position in click order
    const buttonClickOrder = new Map<number, number>();
    const buttonsToClick = allButtonLocators.filter(b => b.count > 0);
    if (buttonsToClick.length > 0) {
      console.log(
        `[pickleballbrackets] Clicking ${buttonsToClick.length} event buttons for player data...`
      );

      let clickIdx = 0;
      for (const btn of buttonsToClick) {
        try {
          const freshButtons = await page.locator('button').all();
          if (btn.index < freshButtons.length) {
            buttonClickOrder.set(btn.index, clickIdx);
            await freshButtons[btn.index].click();
            await page.waitForTimeout(800);
            clickIdx++;
          }
        } catch {
          // Button may have changed, skip
        }
      }

      await page.waitForTimeout(1500);
    }

    // Build events from DOM data + player API data
    // Match each event to its activityId via its button's click order position
    for (const raw of rawEvents) {
      const parsed = parseEventName(raw.name);

      let skillMin = parsed.skillMin ?? undefined;
      let skillMax = parsed.skillMax ?? undefined;
      if (raw.skillRange) {
        const rangeMatch = raw.skillRange.match(/([\d.]+)\s*[–-]\s*([\d.]+)/);
        if (rangeMatch) {
          skillMin = parseFloat(rangeMatch[1]);
          skillMax = parseFloat(rangeMatch[2]);
        } else {
          const plusMatch = raw.skillRange.match(/([\d.]+)\+/);
          if (plusMatch) {
            skillMin = parseFloat(plusMatch[1]);
            skillMax = undefined;
          }
        }
      }

      // Match this event to its API player data via button click order
      const players: ScrapedPlayer[] = [];
      const clickPos = raw.allButtonIndex >= 0 ? buttonClickOrder.get(raw.allButtonIndex) : undefined;
      const activityId = clickPos != null ? activityIdOrder[clickPos] : undefined;
      if (activityId) {
        const apiPlayers = playersByActivityId.get(activityId) ?? [];

        for (const p of apiPlayers) {
          if (!p.isRegistered) continue; // skip waitlisted
          const skill = parseFloat(p.playerSkill);
          const partnerSkill = parseFloat(p.partnerSkill);
          players.push({
            name: p.playerFullName?.trim(),
            duprRating: !isNaN(skill) && skill > 0 ? skill : undefined,
            partnerName: p.partnerFullName?.trim() || undefined,
            partnerDuprRating: !isNaN(partnerSkill) && partnerSkill > 0 ? partnerSkill : undefined,
            // Identity fields
            sourcePlayerId: p.playerId || undefined,
            sourceSlug: p.playerSlug || undefined,
            location: p.playerCityState || undefined,
            gender: p.playerGender || undefined,
            partnerSourcePlayerId: p.partnerId || undefined,
          });
        }
      }

      events.push({
        name: raw.name,
        eventType: parsed.eventType ?? undefined,
        gender: parsed.gender ?? undefined,
        skillLevelMin: skillMin,
        skillLevelMax: skillMax,
        maxTeams: raw.maxCapacity ?? undefined,
        registeredCount: raw.registeredCount,
        players,
      });
    }

    console.log(
      `[pickleballbrackets] Found ${events.length} events for "${slug}" (${playersByActivityId.size} with player data)`
    );
  } catch (err) {
    console.error(`[pickleballbrackets] Error scraping events for ${slug}:`, err);
  }

  return events;
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

    const description =
      (await page.evaluate(
        () =>
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") || null
      )) || undefined;

    // Scrape events from the /events sub-page
    const events = await scrapeEvents(page, slug);

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
      description,
      rawPageHash: contentHash,
      events: events.length > 0 ? events : undefined,
    };

    console.log(
      `[pickleballbrackets] OK "${pageTitle}" on ${parsedDateStart} at ${locationName} (${events.length} events)`
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
  const { upsertTournaments, upsertEvents } = await import("../utils/upsert.js");

  const run = await startRun(SOURCE_PLATFORM);
  try {
    const tournaments = await scrape();
    const stats = await upsertTournaments(tournaments);

    // Upsert events for tournaments that have event data
    for (const t of tournaments) {
      if (t.events && t.events.length > 0) {
        // Find the tournament ID from the database by source URL
        const { supabase } = await import("../utils/supabase.js");
        const { data } = await supabase
          .from("tournaments")
          .select("id")
          .eq("source_platform", t.sourcePlatform)
          .eq("source_url", t.sourceUrl)
          .maybeSingle();

        if (data?.id) {
          await upsertEvents(data.id, t.events);
        }
      }
    }

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
