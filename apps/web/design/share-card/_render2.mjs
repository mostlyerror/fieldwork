import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
for (const f of ["partner-sticker", "partner-headline"]) {
  const pg = await browser.newPage({ viewport: { width: 1220, height: 1240 }, deviceScaleFactor: 2 });
  await pg.goto("file://" + resolve(dir, f + ".html"), { waitUntil: "networkidle" });
  await pg.waitForTimeout(1600);
  const card = (await pg.$(".card")) || (await pg.$("body"));
  await card.screenshot({ path: resolve(dir, f + ".png") });
  await pg.close();
  console.log(f + ".png written");
}
await browser.close();
