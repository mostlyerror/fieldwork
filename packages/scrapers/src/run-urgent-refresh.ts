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

/** Format one player line, e.g. "• Ben Poon  3.38 → 3.40  (+0.02, +5 matches)". */
function formatPlayerLine(p: PlayerHistorySummary): string {
  const matches = `${p.matchesAdded >= 0 ? "+" : ""}${p.matchesAdded} match${p.matchesAdded === 1 ? "" : "es"}`;

  // Honest rating display: only show a before→after delta when we have both
  // numbers; otherwise just show the current rating (or nothing if unknown).
  let rating = "";
  if (p.ratingBefore != null && p.ratingAfter != null) {
    const delta = p.ratingAfter - p.ratingBefore;
    const deltaStr = `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`;
    rating =
      delta === 0
        ? `${p.ratingAfter.toFixed(2)}  `
        : `${p.ratingBefore.toFixed(2)} → ${p.ratingAfter.toFixed(2)}  (${deltaStr}, `;
  } else if (p.ratingAfter != null) {
    rating = `${p.ratingAfter.toFixed(2)}  `;
  }

  // When there's a non-zero delta we opened a paren above; close it with matches.
  if (rating.endsWith(", ")) return `• ${p.name}  ${rating}${matches})`;
  return `• ${p.name}  ${rating}(${matches})`;
}

/** Best-effort: post the refreshed player history (name, rating, matches) to
 *  Discord — but ONLY for players who actually gained matches this run. The
 *  hourly metered pass mostly re-checks players with no new DUPR matches, and
 *  posting those (+0, no change) is just noise. Stay silent unless something
 *  actually moved. */
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
    const lines = changed.map(formatPlayerLine).join("\n");
    const coverageLine = coverage ? `\n\nDUPR coverage: ${formatCoverage(coverage)}` : "";
    await sendDiscordAlert({
      title: `📊 Player history — ${changed.length} updated`,
      description: `${lines}${coverageLine}`,
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
