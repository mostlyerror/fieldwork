/**
 * Capture eventPlayers API calls from a PBB tournament events page.
 * Usage: npx tsx src/utils/capture-event-api.ts [slug]
 */

import { chromium } from "playwright";

const slug = process.argv[2] || "casa-luck-of-the-dink";
const url = `https://pickleballtournaments.com/tournaments/${slug}/events`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // Capture ALL network requests/responses for the eventPlayers API
  const apiCalls: Array<{ activityId: string; playerCount: number; players: unknown[] }> = [];

  page.on("response", async (res) => {
    const resUrl = res.url();
    if (resUrl.includes("eventPlayers")) {
      try {
        const json = await res.json();
        const urlObj = new URL(resUrl);
        const activityId = urlObj.searchParams.get("activityId") || "unknown";
        apiCalls.push({ activityId, playerCount: json.length, players: json });
        console.log(`  API response: activityId=${activityId}, ${json.length} players`);
      } catch {}
    }
  });

  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Check if the page automatically loads eventPlayers on initial load
  console.log(`\nAPI calls on page load: ${apiCalls.length}`);

  // Try to find events API that returns all activities with IDs
  // Maybe there's an events list endpoint
  console.log("\nSearching for events list API...");

  // Check page's JavaScript for the activityId source
  const activityData = await page.evaluate(() => {
    // Check React fiber for activity data
    const reactRoot = document.getElementById("__next");
    if (!reactRoot) return null;

    // Look for all elements that might have event data
    // The "All" buttons fire fetch calls - let's check what data is available
    const allButtons = document.querySelectorAll("button");
    const buttonInfo: Array<{text: string; attrs: Record<string, string>}> = [];

    for (const btn of allButtons) {
      const text = btn.textContent?.trim() || "";
      if (text.startsWith("All")) {
        const attrs: Record<string, string> = {};
        for (const attr of btn.attributes) {
          attrs[attr.name] = attr.value;
        }
        // Also check parent elements for data
        let parent = btn.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
          for (const attr of parent.attributes) {
            if (attr.name.startsWith("data-")) {
              attrs[`parent${depth}_${attr.name}`] = attr.value;
            }
          }
          parent = parent.parentElement;
          depth++;
        }
        buttonInfo.push({ text, attrs });
      }
    }

    return buttonInfo;
  });

  console.log("\nButton data:");
  if (activityData) {
    for (const b of activityData.slice(0, 5)) {
      console.log(`  "${b.text}" - attrs:`, JSON.stringify(b.attrs));
    }
  }

  // Try fetching the events/activities list API directly
  const tourneyId = "d35b870d-985d-4f9a-bc67-efba7038828a"; // Known from RSC data
  const possibleApis = [
    `https://pickleballtournaments.com/tournaments/api/events?tourneyId=${tourneyId}`,
    `https://pickleballtournaments.com/tournaments/api/activities?tourneyId=${tourneyId}`,
    `https://pickleballtournaments.com/api/v1/tournaments/${slug}/events`,
    `https://pickleballtournaments.com/api/v1/tournaments/${tourneyId}/events`,
    `https://pickleballtournaments.com/tournaments/api/eventCategories?tourneyId=${tourneyId}`,
    `https://pickleballtournaments.com/tournaments/api/eventList?tourneyId=${tourneyId}`,
  ];

  console.log("\nTrying possible events APIs...");
  for (const apiUrl of possibleApis) {
    try {
      const res = await page.evaluate(async (url) => {
        const resp = await fetch(url);
        if (!resp.ok) return { status: resp.status, body: null };
        const text = await resp.text();
        return { status: resp.status, body: text.slice(0, 500) };
      }, apiUrl);
      console.log(`  ${apiUrl}`);
      console.log(`    Status: ${res.status}, Body: ${res.body?.slice(0, 200) || "null"}`);
    } catch (e) {
      console.log(`  ${apiUrl} - ERROR`);
    }
  }

  await browser.close();
}

main();
