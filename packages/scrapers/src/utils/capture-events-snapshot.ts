/**
 * Capture an events page snapshot for debugging DOM structure.
 * Usage: npx tsx src/utils/capture-events-snapshot.ts [slug]
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";

const slug = process.argv[2] || "casa-luck-of-the-dink";
const url = `https://pickleballtournaments.com/tournaments/${slug}/events`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  const html = await page.content();
  const outPath = `test/fixtures/tournament-events.html`;
  writeFileSync(outPath, html);
  console.log(`Saved ${html.length} chars to ${outPath}`);

  // Also dump what we can see in text
  const text = await page.evaluate(() => document.body.innerText);
  writeFileSync(`test/fixtures/tournament-events.txt`, text);
  console.log(`Saved text content to test/fixtures/tournament-events.txt`);

  await browser.close();
}

main();
