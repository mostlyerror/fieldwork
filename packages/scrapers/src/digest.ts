/**
 * PickleRadar Weekly Digest
 *
 * Queries upcoming weekend tournaments and posts a digest to Instagram.
 * Intended to run Thursday evening via GitHub Actions cron.
 */

import { supabase } from "./utils/supabase.js";
import {
  getInstagramConfig,
  postTournamentToInstagram,
} from "./utils/instagram.js";

interface DigestTournament {
  id: string;
  name: string;
  date_start: string;
  date_end: string | null;
  location_name: string;
  entry_fee: number | null;
  skill_levels: string[] | null;
}

function getUpcomingWeekend(): { friday: string; sunday: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 4=Thu, 5=Fri, 6=Sat

  // Calculate days until Friday
  const daysUntilFriday = ((5 - day + 7) % 7) || 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() + daysUntilFriday);

  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);

  return {
    friday: friday.toISOString().split("T")[0],
    sunday: sunday.toISOString().split("T")[0],
  };
}

function buildDigestCaption(
  tournaments: DigestTournament[],
  appUrl: string
): string {
  const lines: string[] = [];

  lines.push("\u{1F3D3} This Weekend's Pickleball Tournaments in Houston");
  lines.push("");

  for (const t of tournaments.slice(0, 10)) {
    const start = new Date(t.date_start + "T00:00:00");
    const dayStr = start.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const fee =
      t.entry_fee != null
        ? t.entry_fee === 0
          ? "Free"
          : `$${t.entry_fee}`
        : "";
    const feeStr = fee ? ` \u2022 ${fee}` : "";
    lines.push(`\u{25AB}\u{FE0F} ${t.name}`);
    lines.push(`   ${dayStr} \u2022 ${t.location_name}${feeStr}`);
    lines.push("");
  }

  if (tournaments.length > 10) {
    lines.push(`...and ${tournaments.length - 10} more!`);
    lines.push("");
  }

  lines.push(`\u{1F517} Browse all at ${appUrl}`);
  lines.push("");
  lines.push(
    "#pickleball #pickleballtournament #houstonpickleball #pickleradar #weekendpickleball"
  );

  return lines.join("\n");
}

async function main() {
  const config = getInstagramConfig();
  if (!config) {
    console.log(
      "[digest] Instagram not configured (missing INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_USER_ID). Skipping."
    );
    return;
  }

  const { friday, sunday } = getUpcomingWeekend();
  console.log(
    `[digest] Fetching tournaments for weekend: ${friday} to ${sunday}`
  );

  const { data: tournaments, error } = await supabase
    .from("tournaments")
    .select(
      "id, name, date_start, date_end, location_name, entry_fee, skill_levels"
    )
    .eq("status", "active")
    .gte("date_start", friday)
    .lte("date_start", sunday)
    .order("date_start", { ascending: true });

  if (error) {
    console.error("[digest] Error fetching tournaments:", error);
    process.exit(1);
  }

  if (!tournaments || tournaments.length === 0) {
    console.log("[digest] No upcoming weekend tournaments found. Skipping.");
    return;
  }

  console.log(`[digest] Found ${tournaments.length} weekend tournament(s)`);

  // Use the digest image as the post image
  const imageUrl = `${config.appUrl}/api/digest-image?from=${friday}&to=${sunday}`;
  const caption = buildDigestCaption(tournaments, config.appUrl);

  // Post directly using the Graph API (same pattern as single tournament posts)
  const GRAPH_API = "https://graph.facebook.com/v21.0";

  try {
    const containerRes = await fetch(
      `${GRAPH_API}/${config.userId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: config.accessToken,
        }),
      }
    );

    if (!containerRes.ok) {
      const err = await containerRes.text();
      console.error("[digest] Container creation failed:", err);
      process.exit(1);
    }

    const { id: containerId } = (await containerRes.json()) as { id: string };

    const publishRes = await fetch(
      `${GRAPH_API}/${config.userId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: config.accessToken,
        }),
      }
    );

    if (!publishRes.ok) {
      const err = await publishRes.text();
      console.error("[digest] Publish failed:", err);
      process.exit(1);
    }

    const { id: mediaId } = (await publishRes.json()) as { id: string };
    console.log(`[digest] Posted weekly digest! Media ID: ${mediaId}`);
  } catch (err) {
    console.error("[digest] Error posting digest:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error in digest:", err);
  process.exit(1);
});
