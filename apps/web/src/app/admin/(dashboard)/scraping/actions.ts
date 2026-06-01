"use server";

import { requireAdmin } from "@/lib/auth";

export async function triggerScraper() {
  await requireAdmin();

  const token = process.env.GITHUB_PAT;
  if (!token) throw new Error("GITHUB_PAT not configured");

  const res = await fetch(
    "https://api.github.com/repos/mostlyerror/pickleradar/actions/workflows/scrape.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub API error: ${res.status} ${text}`);
  }

  return { success: true };
}

/**
 * Scoped "run now" for a single source card.
 *
 * NOTE: the scrape.yml workflow currently takes no per-source input — a dispatch
 * runs every source. So this triggers the same full run regardless of `source`;
 * the argument is accepted for UI attribution + future per-source dispatch. When
 * the workflow grows a `source` input, thread it through the body below.
 */
export async function runSource(_source?: string) {
  return triggerScraper();
}
