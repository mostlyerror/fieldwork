/**
 * PickleRadar Weekly Digest
 *
 * Queries upcoming weekend tournaments and queues a digest post for admin review.
 * The actual Instagram publish happens via the admin social dashboard.
 * Runs Monday afternoon via GitHub Actions cron.
 */

import { Resend } from "resend";
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

function buildDigestEmailHtml(
  tournaments: DigestTournament[],
  appUrl: string,
  recipientEmail: string
): string {
  const rows = tournaments.slice(0, 10).map((t) => {
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
    const feeStr = fee ? ` &bull; ${fee}` : "";
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #f0f0f0">
        <strong style="color:#1a1a1a">${t.name}</strong><br/>
        <span style="color:#666;font-size:14px">${dayStr} &bull; ${t.location_name}${feeStr}</span>
      </td>
    </tr>`;
  });

  const moreText =
    tournaments.length > 10
      ? `<p style="color:#666;font-size:14px">...and ${tournaments.length - 10} more!</p>`
      : "";

  const unsubToken = Buffer.from(recipientEmail).toString("base64url");
  const unsubUrl = `${appUrl}/unsubscribe?token=${unsubToken}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f8faf8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="text-align:center;padding:20px 0">
    <span style="font-size:32px">\u{1F3D3}</span>
    <h1 style="margin:8px 0 0;color:#15803d;font-size:22px">PickleRadar Weekly Digest</h1>
  </div>
  <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 16px;font-size:18px;color:#1a1a1a">This Weekend&rsquo;s Tournaments in Houston</h2>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      ${rows.join("\n")}
    </table>
    ${moreText}
    <div style="text-align:center;margin-top:24px">
      <a href="${appUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px">Browse All Tournaments</a>
    </div>
  </div>
  <div style="text-align:center;padding:24px 0;font-size:12px;color:#999">
    <p>You&rsquo;re getting this because you subscribed on PickleRadar.</p>
    <a href="${unsubUrl}" style="color:#999;text-decoration:underline">Unsubscribe</a>
  </div>
</div>
</body></html>`;
}

async function sendDigestEmails(
  tournaments: DigestTournament[],
  appUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("[digest] RESEND_API_KEY not set — skipping email send");
    return;
  }

  const { data: subscribers, error } = await supabase
    .from("email_subscribers")
    .select("email")
    .eq("status", "active");

  if (error) {
    console.error("[digest] Error fetching subscribers:", error);
    return;
  }

  if (!subscribers || subscribers.length === 0) {
    console.log("[digest] No active subscribers — skipping email send");
    return;
  }

  console.log(`[digest] Sending digest email to ${subscribers.length} subscriber(s)`);

  const resend = new Resend(apiKey);
  const BATCH_SIZE = 50;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sub) =>
        resend.emails.send({
          from: "PickleRadar <digest@pickleradar.app>",
          to: sub.email,
          subject: `\u{1F3D3} This Weekend's Houston Pickleball Tournaments`,
          html: buildDigestEmailHtml(tournaments, appUrl, sub.email),
        })
      )
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      console.warn(`[digest] ${failed}/${batch.length} emails failed in batch`);
    }
  }

  console.log("[digest] Digest emails sent");
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

  // Send digest email to all active subscribers
  await sendDigestEmails(tournaments, appUrl);
}

main().catch((err) => {
  console.error("Fatal error in digest:", err);
  process.exit(1);
});
