/**
 * Smart Tournament Alerts CLI
 *
 * Flags:
 *   --email <addr>   Only consider this subscriber (test mode)
 *   --dry            Compute matches but don't send or record
 *   --list           Print all linked subscribers and exit
 */

import { sendSmartAlerts } from "./smart-alerts.js";
import { supabase } from "./utils/supabase.js";

function getFlag(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function listLinked() {
  const { data } = await supabase
    .from("email_subscribers")
    .select("email, name, link_status, wants_smart_alerts, players!email_subscribers_player_id_fkey(name, dupr_doubles)")
    .eq("status", "active");

  console.log(`Active subscribers: ${data?.length ?? 0}`);
  for (const row of data ?? []) {
    const p = (row as Record<string, unknown>).players as { name?: string; dupr_doubles?: number } | null;
    const linked = p ? ` → ${p.name} (${p.dupr_doubles ?? "?"})` : "";
    const alerts = (row as Record<string, unknown>).wants_smart_alerts ? "" : " [alerts OFF]";
    console.log(`  ${row.email}${row.name ? ` (${row.name})` : ""} · ${row.link_status}${linked}${alerts}`);
  }
}

const onlyEmail = getFlag("email");
const dryRun = hasFlag("dry");
const list = hasFlag("list");

if (list) {
  listLinked().then(() => process.exit(0));
} else {
  console.log(`[smart-alerts] Starting${onlyEmail ? ` for ${onlyEmail}` : ""}${dryRun ? " (DRY RUN)" : ""}...`);

  sendSmartAlerts({ onlyEmail, dryRun })
    .then((r) => {
      console.log("[smart-alerts] Result:", JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("[smart-alerts] Failed:", err);
      process.exit(1);
    });
}
