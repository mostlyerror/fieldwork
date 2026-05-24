import { supabase } from "./supabase.js";
import { sendDiscordAlert } from "./discord.js";

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
 * Complete a scraper run log entry with results.
 */
export async function completeRun(
  run: RunLog,
  stats: {
    tournamentsFound: number;
    tournamentsNew: number;
    tournamentsUpdated: number;
    tournamentsDeduplicated: number;
  }
): Promise<void> {
  if (run.id === "unknown") return;

  const { error } = await supabase
    .from("scraper_runs")
    .update({
      completed_at: new Date().toISOString(),
      status: "success",
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
      `[${run.sourcePlatform}] Run ${run.id} completed — ` +
        `found: ${stats.tournamentsFound}, new: ${stats.tournamentsNew}, ` +
        `updated: ${stats.tournamentsUpdated}, deduped: ${stats.tournamentsDeduplicated}`
    );
  }

  const hasNew = stats.tournamentsNew > 0;
  await sendDiscordAlert({
    title: `✅ Scraper — ${run.sourcePlatform}`,
    description: hasNew
      ? `Found **${stats.tournamentsNew}** new tournament(s)!`
      : "No new tournaments this run.",
    color: hasNew ? 0x16a34a : 0x6b7280,
    fields: [
      { name: "Found", value: String(stats.tournamentsFound), inline: true },
      { name: "New", value: String(stats.tournamentsNew), inline: true },
      { name: "Updated", value: String(stats.tournamentsUpdated), inline: true },
      { name: "Deduped", value: String(stats.tournamentsDeduplicated), inline: true },
    ],
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
