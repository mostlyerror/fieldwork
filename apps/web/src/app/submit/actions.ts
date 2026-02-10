"use server";

import { headers } from "next/headers";
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

// ---------------------------------------------------------------------------
// In-memory URL cache — avoids repeat API calls for the same link
// ---------------------------------------------------------------------------
const urlCache = new Map<
  string,
  { data: ExtractedTournament | null; ts: number }
>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// In-memory rate limiter — 5 extractions per IP per hour
// ---------------------------------------------------------------------------
const rateLimiter = new Map<
  string,
  { count: number; windowStart: number }
>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// JS-heavy domains that won't yield useful text via server-side fetch
// ---------------------------------------------------------------------------
const SKIP_DOMAINS = new Set([
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "tiktok.com",
  "www.tiktok.com",
  "twitter.com",
  "x.com",
]);

function getClientIp(hdrs: Headers): string {
  return (
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(ip);

  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimiter.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

function shouldSkipDomain(url: string): boolean {
  try {
    return SKIP_DOMAINS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export async function extractTournamentFromUrl(
  url: string
): Promise<{ data: ExtractedTournament | null; error?: string }> {
  // Mock mode for local testing — no API credits used
  if (process.env.EXTRACTION_MOCK === "true") {
    await new Promise((r) => setTimeout(r, 1200)); // simulate latency
    return {
      data: {
        name: "Mock Tournament — Houston Open 2026",
        dateStart: "2026-03-15",
        dateEnd: "2026-03-16",
        locationName: "Memorial Park Pickleball Center",
        locationAddress: "7600 Memorial Dr, Houston, TX 77024",
        entryFee: 45,
        format: "double_elim",
        skillLevels: ["3.5", "4.0", "4.5"],
        description: "Two-day doubles tournament with cash prizes.",
      },
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { data: null };

  // Rate limit
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  if (isRateLimited(ip)) {
    return { data: null, error: "Too many extraction requests. Please fill in the details manually." };
  }

  // Cache hit
  const cached = urlCache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { data: cached.data };
  }

  // Skip JS-heavy domains — go straight to manual form
  if (shouldSkipDomain(url)) {
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

    // Cache the result
    urlCache.set(url, { data: parsed, ts: Date.now() });

    return { data: parsed };
  } catch {
    return { data: null };
  }
}
