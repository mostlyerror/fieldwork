const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

export async function sendDiscordAlert(embed: {
  title: string;
  description: string;
  color?: number;
  fields?: DiscordField[];
}) {
  if (!DISCORD_WEBHOOK_URL) return;

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: embed.title,
            description: embed.description,
            color: embed.color ?? 0x16a34a,
            fields: embed.fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch {
    // Never let alert failures break the main flow
  }
}
