"use server";

import { requireAdmin } from "@/lib/auth";

async function dispatchWorkflow(workflow: string) {
  const token = process.env.GITHUB_PAT;
  if (!token) throw new Error("GITHUB_PAT not configured");

  const res = await fetch(
    `https://api.github.com/repos/mostlyerror/pickleradar/actions/workflows/${workflow}/dispatches`,
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

export async function triggerScraper() {
  await requireAdmin();
  return dispatchWorkflow("scrape.yml");
}

/**
 * Scoped "run now" for a single source card. The urgent-refresh lane dispatches
 * its own hourly workflow; every other source dispatches the full scrape
 * (scrape.yml takes no per-source input, so it re-runs all PBB sources — the
 * `source` arg is otherwise just for UI attribution).
 */
export async function runSource(source?: string) {
  await requireAdmin();
  return dispatchWorkflow(
    source === "urgent_refresh" ? "urgent-refresh.yml" : "scrape.yml"
  );
}
