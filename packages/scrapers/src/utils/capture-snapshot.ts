/**
 * Capture a snapshot of a PickleballTournaments.com tournament detail page.
 *
 * Saves the full HTML to test/fixtures/tournament-detail.html and the
 * expected parsed RSC values to test/fixtures/tournament-detail.expected.json.
 *
 * Usage:
 *   npx tsx src/utils/capture-snapshot.ts [slug]
 *
 * If no slug is provided, the script fetches the search API and picks
 * the first available tournament.
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { parseRscTournamentData } from "./parse-rsc.js";

const BASE_URL = "https://pickleballtournaments.com";
const SEARCH_API_URL = `${BASE_URL}/api/v1/search`;

const FIXTURES_DIR = resolve(
  dirname(new URL(import.meta.url).pathname),
  "../../test/fixtures",
);

async function findSlug(): Promise<string> {
  const explicitSlug = process.argv[2];
  if (explicitSlug) return explicitSlug;

  console.log("[capture-snapshot] No slug provided, searching for one...");
  const res = await fetch(`${SEARCH_API_URL}?query=houston`);
  if (!res.ok) throw new Error(`Search API returned ${res.status}`);

  const json = await res.json();
  const tourneys = json?.data?.tourneys ?? [];
  if (tourneys.length === 0) throw new Error("No tournaments found via API");

  const slug = tourneys[0].slug as string;
  console.log(`[capture-snapshot] Using slug: ${slug}`);
  return slug;
}

async function main() {
  const slug = await findSlug();
  const url = `${BASE_URL}/tournaments/${slug}`;
  console.log(`[capture-snapshot] Loading ${url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const html = await page.content();
  await browser.close();

  // Save HTML fixture
  mkdirSync(FIXTURES_DIR, { recursive: true });
  const htmlPath = resolve(FIXTURES_DIR, "tournament-detail.html");
  writeFileSync(htmlPath, html, "utf-8");
  console.log(`[capture-snapshot] Saved HTML (${html.length} chars) to ${htmlPath}`);

  // Parse and save expected values
  const parsed = parseRscTournamentData(html);
  if (!parsed) {
    console.error(
      "[capture-snapshot] parseRscTournamentData returned null — " +
        "the page may have changed structure or the slug has no RSC data.",
    );
    process.exit(1);
  }

  const expectedPath = resolve(FIXTURES_DIR, "tournament-detail.expected.json");
  writeFileSync(expectedPath, JSON.stringify(parsed, null, 2) + "\n", "utf-8");
  console.log(`[capture-snapshot] Saved expected values to ${expectedPath}`);
  console.log("[capture-snapshot] Done.");
}

main().catch((err) => {
  console.error("[capture-snapshot] Fatal:", err);
  process.exit(1);
});
