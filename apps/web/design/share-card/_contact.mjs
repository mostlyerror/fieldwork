import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const items = [
  ["01-tale-of-the-tape.html", "1 · Tale of the Tape"],
  ["02-duo-card.html", "2 · Duo Card"],
  ["03-receipt.html", "3 · The Receipt"],
  ["04-headline.html", "4 · The Headline"],
  ["05-scoreboard.html", "5 · The Scoreboard"],
];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const cells = items
  .map(([f, name]) => {
    const html = readFileSync(resolve(dir, f), "utf8");
    return `<div class="cell"><div class="lab">${name}</div><iframe srcdoc="${esc(html)}"></iframe></div>`;
  })
  .join("");
const page = `<!doctype html><html><head><meta charset="utf-8"><style>
 body{margin:0;background:#efece3;font-family:system-ui,sans-serif;padding:30px}
 .grid{display:grid;grid-template-columns:repeat(3,1180px);gap:30px;width:max-content}
 .cell{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 16px 44px -26px rgba(0,0,0,.45)}
 .lab{font-weight:800;font-size:24px;letter-spacing:-.01em;padding:16px 20px;color:#13231c}
 iframe{width:1180px;height:1260px;border:0;display:block}
</style></head><body><div class="grid">${cells}</div></body></html>`;

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 3720, height: 2800 }, deviceScaleFactor: 1 });
await pg.setContent(page, { waitUntil: "networkidle" });
await pg.waitForTimeout(2000);
await pg.screenshot({ path: resolve(dir, "contact-sheet.png"), fullPage: true });
await browser.close();
console.log("contact-sheet.png written");
