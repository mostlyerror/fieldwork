"use server";

import Anthropic from "@anthropic-ai/sdk";

export interface ExtractedTournament {
  name?: string;
  dateStart?: string;
  dateEnd?: string;
  locationName?: string;
  locationAddress?: string;
  entryFee?: number;
  registrationUrl?: string;
  description?: string;
  format?: string;
  skillLevels?: string[];
}

export async function extractTournamentFromUrl(
  url: string
): Promise<{ data: ExtractedTournament | null; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { data: null };
  }

  // Fetch the page
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PickleRadar/1.0; +https://pickleradar.app)",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { data: null };
    html = await res.text();
  } catch {
    return { data: null };
  }

  // Strip HTML to plain text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);

  if (text.length < 50) return { data: null };

  const anthropic = new Anthropic({ apiKey });

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Extract pickleball tournament information from this web page text. Return ONLY a JSON object with these fields (omit any you can't confidently determine):
- name: tournament name (string)
- dateStart: start date in YYYY-MM-DD format (string)
- dateEnd: end date in YYYY-MM-DD format, only if multi-day (string)
- locationName: venue name (string)
- locationAddress: full street address (string)
- entryFee: entry fee in dollars as a number, 0 if free (number)
- registrationUrl: direct registration link if different from the source URL (string)
- description: one-sentence description (string)
- format: one of "round_robin", "single_elim", "double_elim", "mixed" (string)
- skillLevels: array of levels from ["2.0","2.5","3.0","3.5","4.0","4.5","5.0","5.0+","Pro"] (string[])

Only include fields you're confident about. Respond with valid JSON only, no markdown fences.

URL: ${url}

${text}`,
        },
      ],
    });

    const content =
      message.content[0]?.type === "text" ? message.content[0].text : null;
    if (!content) return { data: null };

    const parsed = JSON.parse(content) as ExtractedTournament;
    return { data: parsed };
  } catch {
    return { data: null };
  }
}
