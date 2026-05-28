"use server";

import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendDiscordAlert } from "@/lib/discord";
import { posthogServer } from "@/lib/posthog-server";

type SubscribeResult =
  | { status: "success" }
  | { status: "already_subscribed" }
  | { status: "error"; message: string };

export async function subscribeEmail(formData: FormData): Promise<SubscribeResult> {
  const email = formData.get("email");
  const nameRaw = formData.get("name");
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";

  if (typeof email !== "string" || !email) {
    return { status: "error", message: "Email is required." };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  const supabase = getSupabaseAdmin();
  const normalizedEmail = email.toLowerCase();

  // Check if already subscribed (active)
  const { data: existing } = await supabase
    .from("email_subscribers")
    .select("id, status, name")
    .eq("email", normalizedEmail)
    .limit(1)
    .single();

  if (existing) {
    if (existing.status === "active") {
      if (name && !existing.name) {
        await supabase.from("email_subscribers").update({ name }).eq("id", existing.id);
      }
      return { status: "already_subscribed" };
    }
    // Re-activate if previously unsubscribed
    const update: Record<string, unknown> = { status: "active" };
    if (name && !existing.name) update.name = name;
    await supabase.from("email_subscribers").update(update).eq("id", existing.id);
    await sendWelcomeDigest(normalizedEmail, supabase);
    return { status: "success" };
  }

  const { error } = await supabase
    .from("email_subscribers")
    .insert({ email: normalizedEmail, name: name || null });

  if (error) {
    // Unique constraint violation = already subscribed
    if (error.code === "23505") {
      return { status: "already_subscribed" };
    }
    console.error("Failed to subscribe email:", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  const { count } = await supabase
    .from("email_subscribers")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  posthogServer?.capture({
    distinctId: normalizedEmail,
    event: "email_subscribed",
    properties: {
      has_name: !!name,
      total_active_subscribers: count ?? null,
      $set: { email: normalizedEmail, name: name || null },
    },
  });

  await sendDiscordAlert({
    title: "🎉 New Subscriber!",
    description: `${normalizedEmail}${name ? ` (${name})` : ""}`,
    color: 0x16a34a,
    fields: [
      { name: "Total Active", value: String(count ?? "?"), inline: true },
    ],
  });

  await sendWelcomeDigest(normalizedEmail, supabase);
  return { status: "success" };
}

interface WelcomeTournament {
  name: string;
  date_start: string;
  location_name: string;
  entry_fee: number | null;
}

async function sendWelcomeDigest(
  email: string,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const today = new Date().toISOString().split("T")[0];
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("name, date_start, location_name, entry_fee")
      .eq("status", "active")
      .gte("date_start", today)
      .order("date_start", { ascending: true })
      .limit(6);

    if (!tournaments || tournaments.length === 0) return;

    const appUrl = process.env.APP_URL ?? "https://pickleradar.app";
    const html = buildWelcomeEmailHtml(tournaments, appUrl, email);
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: "PickleRadar <digest@pickleradar.app>",
      to: email,
      subject: "\u{1F3D3} Welcome to PickleRadar! Here's what's coming up",
      html,
    });
  } catch (err) {
    console.error("Failed to send welcome digest:", err);
  }
}

function buildWelcomeEmailHtml(
  tournaments: WelcomeTournament[],
  appUrl: string,
  recipientEmail: string
): string {
  const rows = tournaments.map((t) => {
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

  const unsubToken = Buffer.from(recipientEmail).toString("base64url");
  const unsubUrl = `${appUrl}/unsubscribe?token=${unsubToken}`;
  const findUrl = `${appUrl}/profile/find?email=${encodeURIComponent(recipientEmail)}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f8faf8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="text-align:center;padding:20px 0">
    <span style="font-size:32px">\u{1F3D3}</span>
    <h1 style="margin:8px 0 0;color:#15803d;font-size:22px">Welcome to PickleRadar!</h1>
    <p style="margin:8px 0 0;color:#666;font-size:15px">You&rsquo;re all set for weekly tournament updates.</p>
  </div>
  <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 16px;font-size:18px;color:#1a1a1a">Here&rsquo;s what&rsquo;s coming up in Houston</h2>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      ${rows.join("\n")}
    </table>
    <div style="text-align:center;margin-top:24px">
      <a href="${appUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px">Browse All Tournaments</a>
    </div>
  </div>
  <div style="background:#fff;border-radius:16px;padding:20px 24px;border:1px solid #e5e7eb;margin-top:16px;text-align:center">
    <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#1a1a1a">Want personalized alerts?</p>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px">Claim your player profile to get tournaments that match your skill level — and a heads-up when partners you&rsquo;ve played with register.</p>
    <a href="${findUrl}" style="display:inline-block;background:#065f46;color:#fff;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">Claim your profile →</a>
  </div>
  <div style="text-align:center;padding:24px 0;font-size:12px;color:#999">
    <p>Every Monday we&rsquo;ll send you the latest Houston pickleball tournaments.</p>
    <a href="${unsubUrl}" style="color:#999;text-decoration:underline">Unsubscribe</a>
  </div>
</div>
</body></html>`;
}
