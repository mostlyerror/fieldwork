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
import {
  fetchTournamentRosterHistory,
  type PlayerHistorySummary,
} from "./utils/match-history.js";
import { sendDiscordAlert } from "./utils/discord.js";
import { getDuprCoverage, formatCoverage } from "./utils/dupr-coverage.js";
import { duprFetch } from "./utils/dupr-fetch.js";
import { startRun, completeRun, failRun } from "./utils/logger.js";

// Metered: at most this many tournament-rostered players get their DUPR history
// refreshed per hourly run, so current/recent tournaments stay complete and
// fresh without bursting the DUPR API. Best-effort — never fails the refresh.
const ROSTER_REFRESH_CAP = 5;

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
    const res = await duprFetch("https://api.dupr.gg/auth/v1.0/login/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // DUPR's edge returns 400/FAILURE to bare datacenter requests; a
        // browser-like header set gets the login past it from CI IPs.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://dashboard.dupr.com",
        Referer: "https://dashboard.dupr.com/",
      },
      body: JSON.stringify({ email: process.env.DUPR_EMAIL, password: process.env.DUPR_PASSWORD }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.status !== "SUCCESS" || !data?.result?.accessToken) {
      // DUPR login works from CI directly; a failure here is a real problem —
      // most often a stale DUPR_EMAIL/DUPR_PASSWORD secret (DUPR returns
      // 400/FAILURE for bad creds). Surface it so it doesn't silently rot.
      const detail = `HTTP ${res.status}, status=${data?.status ?? "?"}`;
      console.error(`[urgent-refresh] roster history: DUPR login failed (${detail})`);
      await sendDiscordAlert({
        title: "⚠️ DUPR login failed — player history not refreshed",
        description: `DUPR returned ${detail}. Usually a stale DUPR_EMAIL/DUPR_PASSWORD secret. No player data pulled this run.`,
      }).catch(() => {});
      return;
    }
    const r = await fetchTournamentRosterHistory(data.result.accessToken, ROSTER_REFRESH_CAP);
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
