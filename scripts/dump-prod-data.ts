/**
 * Dump production data from Supabase to local JSON files.
 * Uses the service role key to bypass RLS.
 *
 * Usage: npx tsx scripts/dump-prod-data.ts
 *
 * Output: supabase/seed/ directory with JSON files per table.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("Run from apps/web with: npx tsx ../../scripts/dump-prod-data.ts");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TABLES = [
  "tournaments",
  "tournament_sources",
  "tournament_events",
  "event_players",
  "email_subscribers",
  "scraper_runs",
  "social_posts",
  "submission_rate_limits",
];

const OUT_DIR = join(process.cwd(), "..", "..", "supabase", "seed");

async function dumpTable(table: string) {
  console.log(`Dumping ${table}...`);

  let allData: unknown[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(offset, offset + pageSize - 1);

    if (error) {
      // Table might not exist yet (e.g. tournament_events before migration)
      if (error.code === "42P01") {
        console.log(`  ⚠ Table ${table} does not exist yet, skipping`);
        return;
      }
      console.error(`  Error dumping ${table}:`, error.message);
      return;
    }

    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    offset += pageSize;

    if (data.length < pageSize) break;
  }

  const outPath = join(OUT_DIR, `${table}.json`);
  writeFileSync(outPath, JSON.stringify(allData, null, 2));
  console.log(`  ✓ ${allData.length} rows → ${outPath}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Dumping prod data to ${OUT_DIR}\n`);

  for (const table of TABLES) {
    await dumpTable(table);
  }

  console.log("\nDone! Seed files written to supabase/seed/");
  console.log("Note: users table is excluded (contains auth data).");
}

main();
