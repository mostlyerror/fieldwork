import { supabase } from "./supabase.js";
import { sendDiscordAlert } from "./discord.js";
import { ZERO_CHECK_WINDOW } from "./zero-check.js";

export interface RunLog {
  id: string;
  sourcePlatform: string;
}

/**
 * Start a scraper run log entry. Returns the run ID for later completion.
 */
export async function startRun(sourcePlatform: string): Promise<RunLog> {
  const { data, error } = await supabase
    .from("scraper_runs")
    .insert({ source_platform: sourcePlatform })
    .select("id, source_platform")
    .single();

  if (error) {
    console.error(`[${sourcePlatform}] Failed to create run log:`, error);
    // Return a placeholder so the scraper can still run
    return { id: "unknown", sourcePlatform };
  }

  console.log(`[${sourcePlatform}] Started run ${data.id}`);
  return { id: data.id, sourcePlatform: data.source_platform };
}

/**
 * tournaments_found from a source's last healthy (`success`) runs, newest
 * first. Only healthy runs count, so a source stuck at 0 keeps its old
 * baseline and keeps alerting instead of going quiet after a few runs.
 */
export async function recentFoundCounts(sourcePlatform: string): Promise<number[]> {
  const { data, error } = await supabase
    .from("scraper_runs")
    .select("tournaments_found")
    .eq("source_platform", sourcePlatform)
    .eq("status", "success")
    .order("completed_at", { ascending: false })
    .limit(ZERO_CHECK_WINDOW);

  if (error) {
    console.error(`[${sourcePlatform}] Failed to read recent runs:`, error);
    return [];
  }
  return (data ?? []).map((r) => r.tournaments_found ?? 0);
}

/**
 * Complete a scraper run log entry with results. Pass `status` to save the run
 * as something other than `success` (e.g. a suspicious zero).
 */
export async function completeRun(
  run: RunLog,
  stats: {
    tournamentsFound: number;
    tournamentsNew: number;
    tournamentsUpdated: number;
    tournamentsDeduplicated: number;
    newTournamentIds?: string[];
  },
  opts?: { silent?: boolean; status?: string }
): Promise<void> {
  if (run.id === "unknown") return;
  const status = opts?.status ?? "success";

  const { error } = await supabase
    .from("scraper_runs")
    .update({
      completed_at: new Date().toISOString(),
      status,
      tournaments_found: stats.tournamentsFound,
      tournaments_new: stats.tournamentsNew,
      tournaments_updated: stats.tournamentsUpdated,
      tournaments_deduplicated: stats.tournamentsDeduplicated,
    })
    .eq("id", run.id);

  if (error) {
    console.error(`[${run.sourcePlatform}] Failed to update run log:`, error);
  } else {
    console.log(
      `[${run.sourcePlatform}] Run ${run.id} completed (${status}) — ` +
        `found: ${stats.tournamentsFound}, new: ${stats.tournamentsNew}, ` +
        `updated: ${stats.tournamentsUpdated}, deduped: ${stats.tournamentsDeduplicated}`
    );
  }

  // Caller (e.g. urgent refresh) sends its own summary — log the run silently.
  if (opts?.silent) return;

  const hasNew = stats.tournamentsNew > 0;
  let newTournamentLinks = "";
  if (hasNew && stats.newTournamentIds && stats.newTournamentIds.length > 0) {
    const { data: newTournaments } = await supabase
      .from("tournaments")
      .select("id, name")
      .in("id", stats.newTournamentIds);
    if (newTournaments) {
      newTournamentLinks = newTournaments
        .map((t) => `• [${t.name}](https://pickleradar.app/houston/tournaments/${t.id})`)
        .join("\n");
    }
  }

  const fields = [
    { name: "Found", value: String(stats.tournamentsFound), inline: true },
    { name: "New", value: String(stats.tournamentsNew), inline: true },
    { name: "Updated", value: String(stats.tournamentsUpdated), inline: true },
    { name: "Deduped", value: String(stats.tournamentsDeduplicated), inline: true },
  ];
  if (newTournamentLinks) {
    fields.push({ name: "New Tournaments", value: newTournamentLinks, inline: false });
  }

  await sendDiscordAlert({
    title: status === "success"
      ? `✅ Scraper — ${run.sourcePlatform}`
      : `⚠️ Scraper (${status}) — ${run.sourcePlatform}`,
    description: hasNew
      ? `Found **${stats.tournamentsNew}** new tournament(s)!`
      : "No new tournaments this run.",
    color: hasNew ? 0x16a34a : 0x6b7280,
    fields,
  });
}

/**
 * Mark a scraper run as failed.
 */
export async function failRun(
  run: RunLog,
  errorMessage: string
): Promise<void> {
  if (run.id === "unknown") return;

  const { error } = await supabase
    .from("scraper_runs")
    .update({
      completed_at: new Date().toISOString(),
      status: "error",
      error_message: errorMessage,
    })
    .eq("id", run.id);

  if (error) {
    console.error(`[${run.sourcePlatform}] Failed to update run log:`, error);
  } else {
    console.error(
      `[${run.sourcePlatform}] Run ${run.id} failed: ${errorMessage}`
    );
  }

  await sendDiscordAlert({
    title: `🚨 Scraper FAILED — ${run.sourcePlatform}`,
    description: errorMessage,
    color: 0xdc2626,
  });
}
