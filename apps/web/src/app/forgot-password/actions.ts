"use server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

/**
 * Send a password-reset email WITHOUT going through Supabase's custom SMTP
 * (which times out at ~10s and 504s unreliably). Instead we mint the recovery
 * link with the admin API (generateLink — no email sent by Supabase) and deliver
 * it ourselves through the Brevo API, the same fast path that sends digests.
 *
 * The recovery link verifies and redirects to /reset-password with the recovery
 * token in the URL hash, exactly like Supabase's own email would — so the
 * existing reset-password page handles it unchanged.
 */

/** Only redirect back to origins we control (prevents open-redirect via redirectTo). */
function safeOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    const host = u.hostname;
    const ok =
      host === "pickleradar.app" ||
      host === "www.pickleradar.app" ||
      host === "localhost" ||
      host === "127.0.0.1";
    if (ok) return u.origin;
  } catch {
    // fall through
  }
  return "https://pickleradar.app";
}

export async function requestPasswordReset(
  email: string,
  origin: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, error: "Enter your email address." };

  const redirectTo = `${safeOrigin(origin)}/reset-password`;

  let link: string;
  try {
    const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
      type: "recovery",
      email: trimmed,
      options: { redirectTo },
    });
    if (error || !data?.properties?.action_link) {
      // Don't leak whether the account exists — a missing user looks like success.
      const msg = (error?.message || "").toLowerCase();
      if (msg.includes("not found") || msg.includes("no user") || msg.includes("does not exist")) {
        return { ok: true };
      }
      console.error("[forgot-password] generateLink failed", error);
      return { ok: false, error: "Couldn't create a reset link. Try again in a minute." };
    }
    link = data.properties.action_link;
  } catch (e) {
    console.error("[forgot-password] generateLink threw", e);
    return { ok: false, error: "Couldn't create a reset link. Try again in a minute." };
  }

  const sent = await sendEmail({
    to: trimmed,
    subject: "Reset your PickleRadar password",
    fromEmail: "noreply@pickleradar.app",
    html: resetEmailHtml(link),
  });

  if (!sent.ok) {
    console.error("[forgot-password] Brevo send failed", sent.error);
    return { ok: false, error: "Couldn't send the email right now. Try again in a minute." };
  }

  return { ok: true };
}

function resetEmailHtml(link: string): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#FFFDF7;font-family:'Plus Jakarta Sans',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#065f46;margin-bottom:28px;">PickleRadar</div>
    <h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em;margin:0 0 12px;">Reset your password</h1>
    <p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 24px;">
      Click the button below to choose a new password. This link expires in about an hour and can only be used once. If you didn&rsquo;t request this, you can safely ignore this email.
    </p>
    <a href="${link}" style="display:inline-block;background:#047857;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:999px;">Reset password</a>
    <p style="font-size:12px;line-height:1.6;color:#9ca3af;margin:28px 0 0;word-break:break-all;">
      Or paste this link into your browser:<br />${link}
    </p>
    <p style="font-size:12px;color:#9ca3af;margin:28px 0 0;">Made in Houston &middot; pickleradar.app</p>
  </div>
</body>
</html>`;
}
