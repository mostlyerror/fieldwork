/**
 * Urgent Refresh CLI
 *
 * Lightweight re-scrape for tournaments closing or starting soon.
 * Runs hourly via GitHub Actions; can also be invoked manually.
 *
 * Logs each run to scraper_runs (source_platform "urgent_refresh") so it shows up
 * on /admin/scraping with its own health lane. Success is logged silently —
 * runUrgentRefresh sends its own ♻️ summary, so completeRun shouldn't double-post.
 * A hard failure goes through failRun, which fires the 🚨 alert the refresh
 * otherwise never sent (the observability gap this closes).
 */

import { runUrgentRefresh } from "./urgent-refresh.js";
import { fetchLiveMatches } from "./utils/live-matches.js";
import {
  pullQueuedPlayers,
  type PlayerHistorySummary,
} from "./utils/match-history.js";
import { sendDiscordAlert } from "./utils/discord.js";
import { getDuprCoverage, formatCoverage } from "./utils/dupr-coverage.js";
import { getDuprToken } from "./utils/dupr-client.js";
import { startRun, completeRun, failRun } from "./utils/logger.js";

// Metered: at most this many tournament-rostered players get their DUPR history
// refreshed per hourly run, so current/recent tournaments stay complete and
// fresh without bursting the DUPR API. Best-effort — never fails the refresh.
// 12/hr (was 5) so a busy tournament weekend's roster drains in hours, not days;
// the run still finishes well under the workflow timeout. Priority ordering
// (migration 031) ensures the 12 are the players who most need a pull.
const ROSTER_REFRESH_CAP = 12;

/** Best-effort: post an aggregate summary of the refreshed player history to
 *  Discord — but ONLY when players actually gained matches this run. The
 *  hourly metered pass mostly re-checks players with no new DUPR matches, and
 *  posting those (+0, no change) is just noise. Per-player lines proved noisy
 *  too, so this stays aggregate-only: counts and rating movement, no names. */
async function postPlayerHistory(players: PlayerHistorySummary[]): Promise<void> {
  const changed = players.filter((p) => p.matchesAdded > 0);
  if (changed.length === 0) return;
  // Manual/backfill runs (workflow_dispatch) can drain many players in quick
  // succession — don't flood Discord. Only the scheduled hourly pass alerts.
  if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    console.log(`[urgent-refresh] ${changed.length} updated (silent — manual run)`);
    return;
  }
  try {
    const coverage = await getDuprCoverage().catch(() => null);
    const totalMatches = changed.reduce((sum, p) => sum + p.matchesAdded, 0);
    const deltas = changed
      .filter((p) => p.ratingBefore != null && p.ratingAfter != null)
      .map((p) => p.ratingAfter! - p.ratingBefore!)
      .filter((d) => d !== 0);
    const up = deltas.filter((d) => d > 0).length;
    const down = deltas.filter((d) => d < 0).length;
    const ratingsPart = deltas.length > 0 ? ` · ratings moved: ${up}↑ ${down}↓` : "";
    const coverageLine = coverage ? `\n\nDUPR coverage: ${formatCoverage(coverage)}` : "";
    await sendDiscordAlert({
      title: `📊 Player history — ${changed.length} updated`,
      description: `+${totalMatches} match${totalMatches === 1 ? "" : "es"} across ${changed.length} player${changed.length === 1 ? "" : "s"}${ratingsPart}${coverageLine}`,
    });
  } catch (err) {
    console.error("[urgent-refresh] player history alert failed (non-fatal):", err);
  }
}

async function rosterHistoryPass(): Promise<void> {
  if (!process.env.DUPR_EMAIL || !process.env.DUPR_PASSWORD) {
    console.warn("[urgent-refresh] roster history: DUPR creds missing, skipping");
    return;
  }
  console.log("[urgent-refresh] roster history: starting DUPR login...");
  try {
    // Login, headers, pacing, retries, and the global daily budget all live in
    // dupr-client.ts. A failed login is alerted to Discord by the client.
    if (!(await getDuprToken())) return;
    const r = await pullQueuedPlayers(ROSTER_REFRESH_CAP);
    console.log(`[urgent-refresh] roster history: ${r.playersChecked} player(s) due, ${r.matchesInserted} matches`);
    if (r.playersChecked > 0) {
      await postPlayerHistory(r.players);
    } else {
      console.log("[urgent-refresh] roster history: nobody due for refresh (all within 24h floor)");
    }
  } catch (err) {
    console.error("[urgent-refresh] roster history pass failed (non-fatal):", err);
    await sendDiscordAlert({
      title: "⚠️ Roster history pass errored",
      description: `${err instanceof Error ? err.message : String(err)} (non-fatal — refresh itself succeeded).`,
    }).catch(() => {});
  }
}

async function main() {
  const run = await startRun("urgent_refresh");
  try {
    const r = await runUrgentRefresh();
    console.log("[urgent-refresh] Result:", JSON.stringify(r, null, 2));
    await completeRun(
      run,
      {
        tournamentsFound: r.tournamentsChecked,
        tournamentsNew: 0, // urgent refresh never discovers new tournaments
        tournamentsUpdated: r.eventsUpdated,
        tournamentsDeduplicated: 0,
      },
      { silent: true },
    );
    // Live match pass: hourly bracket/score updates on tournament days. JSON
    // APIs only, scoped to tournaments playing today (venue-local) — a no-op
    // on quiet days. The 2x-daily full scrape alone missed evening matches
    // entirely before its date logic went venue-local; hourly keeps the live
    // bracket honest during play. Best-effort, console-only (no Discord —
    // the full-scrape pass already alerts).
    try {
      const lm = await fetchLiveMatches();
      if (lm.matchesUpserted > 0) {
        console.log(
          `[urgent-refresh] live matches: ${lm.tournamentsChecked} tournament(s), ${lm.matchesUpserted} matches upserted`,
        );
      }
    } catch (err) {
      console.error("[urgent-refresh] live match pass failed (non-fatal):", err);
    }
    // Metered tournament-roster history pass — gentle on DUPR, best-effort.
    await rosterHistoryPass();
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[urgent-refresh] Failed:", err);
    await failRun(run, message);
    process.exit(1);
  }
}

main();
