/**
 * PickleRadar Weekly Digest
 *
 * Queries upcoming weekend tournaments and queues a digest post for admin review.
 * The actual Instagram publish happens via the admin social dashboard.
 * Runs Monday afternoon via GitHub Actions cron.
 */

import { supabase } from "./utils/supabase.js";

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
  const appUrl = process.env.APP_URL ?? "https://pickleradar.app";
  const { friday, sunday } = getUpcomingWeekend();
  console.log(
    `[digest] Fetching tournaments for weekend: ${friday} to ${sunday}`
  );

  // Dedup: skip if a queued/published digest already exists for this weekend
  const { data: existing } = await supabase
    .from("social_posts")
    .select("id")
    .eq("post_type", "digest")
    .in("status", ["queued", "published"])
    .contains("metadata", { weekend_start: friday })
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(
      `[digest] Digest already exists for weekend ${friday}. Skipping.`
    );
    return;
  }

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

  const imageUrl = `${appUrl}/api/digest-image?from=${friday}&to=${sunday}`;
  const caption = buildDigestCaption(tournaments, appUrl);

  const { error: insertErr } = await supabase.from("social_posts").insert({
    post_type: "digest",
    status: "queued",
    platform: "instagram",
    caption,
    image_url: imageUrl,
    metadata: {
      weekend_start: friday,
      weekend_end: sunday,
      tournament_count: tournaments.length,
    },
  });

  if (insertErr) {
    console.error("[digest] Error inserting social post:", insertErr);
    process.exit(1);
  }

  console.log(
    `[digest] Queued weekly digest for admin review (${tournaments.length} tournaments)`
  );
}

main().catch((err) => {
  console.error("Fatal error in digest:", err);
  process.exit(1);
});
