const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

export async function sendDiscordAlert(alert: {
  title: string;
  description: string;
  color?: number;
  fields?: DiscordField[];
}) {
  if (!DISCORD_WEBHOOK_URL) return;

  const parts = [alert.title, alert.description];
  if (alert.fields?.length) {
    parts.push(alert.fields.map((f) => `${f.name}: ${f.value}`).join(" · "));
  }
  const line = parts.join(" — ");

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: line }),
    });
  } catch {
    // Never let alert failures break the main flow
  }
}
