export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
}

export async function sendEmail(
  args: SendEmailArgs,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY not set" };
  }

  const { to, subject, html, fromEmail = "digest@pickleradar.app", fromName = "PickleRadar", replyTo } = args;

  const body: Record<string, unknown> = {
    sender: { email: fromEmail, name: fromName },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };

  if (replyTo) {
    body.replyTo = { email: replyTo };
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Brevo ${res.status}: ${text.slice(0, 200)}` };
  }

  return { ok: true };
}
