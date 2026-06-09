/**
 * PickleRadar Scraper Runner
 *
 * Runs all configured scrapers sequentially, logging results to the database.
 * Add new sources by importing their scrape function and adding to the sources array.
 */

import { startRun, completeRun, failRun } from "./utils/logger.js";
import { upsertTournaments, upsertEvents } from "./utils/upsert.js";
import { scrape as scrapePickleballBrackets } from "./sources/pickleballbrackets.js";
import { scrape as scrapePickleballDen } from "./sources/pickleballden.js";
import { sendDiscordAlert } from "./utils/discord.js";
import { scrapeDuprIds } from "./utils/scrape-dupr-ids.js";
import { enrichDuprRatings } from "./utils/dupr-enrichment.js";
import { fetchLiveMatches } from "./utils/live-matches.js";
import { writePlacements } from "./utils/placements.js";
import { snapshotEnrichedDupr } from "./utils/snapshot-dupr.js";
import { supabase } from "./utils/supabase.js";
import { posthog, SCRAPER_ID, shutdownPostHog } from "./utils/posthog.js";
import type { ScraperSource } from "./types.js";
import type { UpsertStats } from "./utils/upsert.js";

const sources: ScraperSource[] = [
  {
    name: "pickleballbrackets",
    scrape: scrapePickleballBrackets,
  },
  {
    name: "pickleball_den",
    scrape: scrapePickleballDen,
  },
  // Future sources:
  // { name: "houston_ssc", scrape: scrapeHoustonSSC },
  // { name: "sportsmonkey", scrape: scrapeSportsmonkey },
];

interface SourceResult {
  name: string;
  ok: boolean;
  found: number;
  stats?: UpsertStats;
  error?: string;
}

async function runHealthCheck(results: SourceResult[]) {
  const failures = results.filter((r) => !r.ok);
  const zeroResults = results.filter((r) => r.ok && r.found === 0);
  const warnings: string[] = [];

  if (failures.length === results.length) {
    await sendDiscordAlert({
      title: "🚨 ALL SCRAPERS FAILED",
      description: "Every source errored out. The tournament feed is not being updated.",
      color: 0xdc2626,
      fields: failures.map((f) => ({
        name: f.name,
        value: f.error ?? "Unknown error",
      })),
    });
    return;
  }

  if (zeroResults.length > 0) {
    warnings.push(
      `**Zero results** from: ${zeroResults.map((r) => r.name).join(", ")} — possible silent failure`
    );
  }

  // Check for >50% drop from last successful run per source
  for (const result of results.filter((r) => r.ok && r.found > 0)) {
    const { data: lastRun } = await supabase
      .from("scraper_runs")
      .select("tournaments_found")
      .eq("source_platform", result.name)
      .eq("status", "success")
      .gt("tournaments_found", 0)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRun && lastRun.tournaments_found > 0) {
      const dropPct = 1 - result.found / lastRun.tournaments_found;
      if (dropPct > 0.5) {
        warnings.push(
          `**${result.name}**: found ${result.found} tournaments (was ${lastRun.tournaments_found} last run, ${Math.round(dropPct * 100)}% drop)`
        );
      }
    }
  }

  if (warnings.length > 0) {
    await sendDiscordAlert({
      title: "⚠️ Scraper Health Warning",
      description: warnings.join("\n\n"),
      color: 0xeab308,
    });
  }
}

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`PickleRadar Scraper — ${new Date().toISOString()}`);
  console.log(`Running ${sources.length} source(s)`);
  console.log(`${"=".repeat(60)}\n`);

  const results: SourceResult[] = [];

  for (const source of sources) {
    const run = await startRun(source.name);

    try {
      const tournaments = await source.scrape();
      const stats = await upsertTournaments(tournaments);

      for (const t of tournaments) {
        if (t.events && t.events.length > 0) {
          const { data } = await supabase
            .from("tournaments")
            .select("id")
            .eq("source_platform", t.sourcePlatform)
            .eq("source_url", t.sourceUrl)
            .maybeSingle();

          if (data?.id) {
            await upsertEvents(data.id, t.events);
          }
        }
      }

      await completeRun(run, {
        tournamentsFound: tournaments.length,
        ...stats,
      });

      posthog?.capture({
        distinctId: SCRAPER_ID,
        event: "scraper_run_completed",
        properties: {
          source: source.name,
          tournaments_found: tournaments.length,
          tournaments_new: stats.tournamentsNew,
          tournaments_updated: stats.tournamentsUpdated,
          tournaments_deduplicated: stats.tournamentsDeduplicated,
        },
      });

      if (stats.newTournamentNames.length > 0) {
        await sendDiscordAlert({
          title: "🆕 New tournaments",
          description: stats.newTournamentNames.join(", "),
        });
      }
      if (stats.updatedTournamentNames.length > 0) {
        await sendDiscordAlert({
          title: "✏️ Tournaments updated",
          description: stats.updatedTournamentNames.join(", "),
        });
      }

      results.push({ name: source.name, ok: true, found: tournaments.length, stats });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await failRun(run, message);
      posthog?.captureException(err, SCRAPER_ID, { source: source.name });
      posthog?.capture({
        distinctId: SCRAPER_ID,
        event: "scraper_run_failed",
        properties: { source: source.name, error: message },
      });
      console.error(`[${source.name}] Source failed, continuing to next...`);
      results.push({ name: source.name, ok: false, found: 0, error: message });
    }

    console.log(""); // blank line between sources
  }

  await runHealthCheck(results);

  // Auto-archive tournaments that ended >30 days ago: flip 'active' → 'archived'
  // (terminal, off public surfaces, still reachable by direct link). Past events
  // stay discoverable for 30 days for results; after that they retire here.
  try {
    const { data: archivedCount, error } = await supabase.rpc(
      "archive_past_tournaments",
    );
    if (error) {
      console.error("[auto-archive] RPC failed:", error.message);
    } else if (typeof archivedCount === "number" && archivedCount > 0) {
      console.log(`[auto-archive] Archived ${archivedCount} past tournament(s).`);
      await sendDiscordAlert({
        title: "🗄️ Auto-archived past tournaments",
        description: `${archivedCount} tournament(s) >30 days past their end date moved to archived.`,
      });
    }
  } catch (err) {
    console.error("[auto-archive] Error:", err);
  }

  // Propagate venue photos onto tournaments (denormalized for the grid cards).
  try {
    const { data: synced, error } = await supabase.rpc(
      "sync_tournament_venue_photos",
    );
    if (error) {
      console.error("[venue-photo-sync] RPC failed:", error.message);
    } else if (typeof synced === "number" && synced > 0) {
      console.log(`[venue-photo-sync] Synced ${synced} tournament photo(s).`);
    }
  } catch (err) {
    console.error("[venue-photo-sync] Error:", err);
  }

  // Check for active tournaments that weren't seen in this scrape (may have been cancelled)
  try {
    const successfulSources = results.filter((r) => r.ok).map((r) => r.name);
    if (successfulSources.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const { data: activeInDb } = await supabase
        .from("tournaments")
        .select("id, name, source_platform, updated_at")
        .eq("status", "active")
        .gte("date_end", today)
        .in("source_platform", successfulSources);

      if (activeInDb) {
        const stale = activeInDb.filter((t) => {
          const updated = new Date(t.updated_at as string);
          const hoursSinceUpdate = (Date.now() - updated.getTime()) / (1000 * 60 * 60);
          return hoursSinceUpdate > 48;
        });

        if (stale.length > 0 && stale.length <= 10) {
          await sendDiscordAlert({
            title: "👻 Tournaments not seen in 48h",
            description: stale.map((t) => t.name as string).join(", "),
          });
        }
      }
    }
  } catch (err) {
    console.error("[stale-check] Error checking for removed tournaments:", err);
  }

  // Scrape DUPR IDs from pickleball.com for players missing them
  try {
    const idResult = await scrapeDuprIds();
    if (idResult.found > 0) {
      console.log(`[dupr-ids] Found ${idResult.found} new DUPR IDs from pickleball.com`);
    }
  } catch (err) {
    console.error("[dupr-ids] DUPR ID scrape failed:", err);
  }

  // DUPR discovery/enrichment: name-match players the pull queue can't reach.
  // (Match-history pulls moved to the shared queue — hourly urgent-refresh +
  // twice-daily enrich-matches drain it; scrape no longer double-dips DUPR.)
  if (process.env.DUPR_EMAIL && process.env.DUPR_PASSWORD) {
    try {
      const enrichResult = await enrichDuprRatings();
      posthog?.capture({
        distinctId: SCRAPER_ID,
        event: "dupr_enrichment_completed",
        properties: {
          players_checked: enrichResult.checked,
          players_updated: enrichResult.updated,
        },
      });
      if (enrichResult.updated > 0) {
        await sendDiscordAlert({
          title: "📊 DUPR Enrichment Complete",
          description: `Checked ${enrichResult.checked} players, updated ${enrichResult.updated} ratings`,
          color: 0x22c55e,
        });
        const snapshotted = await snapshotEnrichedDupr();
        if (snapshotted > 0) {
          console.log(`[dupr-enrich] Snapshotted ${snapshotted} event_players with enriched ratings`);
        }
      }
    } catch (err) {
      console.error("[dupr-enrich] Enrichment step failed:", err);
    }
  }

  // Live match tracking: fetch bracket/match data for in-progress tournaments
  try {
    const liveResult = await fetchLiveMatches();
    if (liveResult.matchesUpserted > 0) {
      await sendDiscordAlert({
        title: "🏆 Live Matches Updated",
        description: `Checked ${liveResult.tournamentsChecked} tournament(s), ${liveResult.eventsChecked} events, upserted ${liveResult.matchesUpserted} matches`,
        color: 0xf59e0b,
      });
    }
  } catch (err) {
    console.error("[live-matches] Live match fetch failed:", err);
  }

  // Write placements for completed tournaments
  try {
    const placed = await writePlacements();
    posthog?.capture({
      distinctId: SCRAPER_ID,
      event: "placements_recorded",
      properties: { placements_written: placed },
    });
    if (placed > 0) {
      await sendDiscordAlert({
        title: "🏆 Placements recorded",
        description: `${placed} medalists written`,
      });
    }
  } catch (err) {
    console.error("[placements] Placement scrape failed:", err);
  }

  console.log("All sources processed.");
  await shutdownPostHog();
}

main().catch(async (err) => {
  console.error("Fatal error in scraper runner:", err);
  posthog?.captureException(err, SCRAPER_ID);
  await shutdownPostHog();
  process.exit(1);
});
