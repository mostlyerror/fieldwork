import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Auto-load env from the repo's .env files for local CLI use.
 * In CI / GitHub Actions, env vars are passed in directly and this is a no-op
 * for any var the workflow sets.
 *
 * Precedence (highest wins):
 *   1. Existing shell env (set before invocation)
 *   2. apps/web/.env.local
 *   3. apps/web/.env
 *   4. repo/.env.local
 *   5. repo/.env
 *
 * Assumes the script is run from the repo root (which is the case for both
 * `npx tsx packages/scrapers/src/...` and GitHub Actions). If run from a
 * subdirectory, the auto-loader won't find the files but the script will
 * still work via passed-in env vars.
 */
function loadLocalEnv() {
  const repoRoot = process.cwd();

  // Snapshot what was in the real shell env before any file loading
  const shellEnv = new Set(Object.keys(process.env));

  // Load files in INCREASING precedence order; later files override earlier ones.
  const files = [
    resolve(repoRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, "apps", "web", ".env"),
    resolve(repoRoot, "apps", "web", ".env.local"),
  ];

  for (const path of files) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      // Never override what was actually in the shell environment
      if (shellEnv.has(key)) continue;
      let val = m[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}

loadLocalEnv();

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables",
  );
}

// Service role client bypasses RLS — used by scrapers only
export const supabase = createClient(supabaseUrl, supabaseKey);
