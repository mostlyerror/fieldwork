import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  worstStatus,
  ADMIN_STATUS,
  type AdminStatus,
} from "@/lib/admin-status";
import { AttentionBanner, type ProblemChip } from "@/components/admin/attention-banner";
import { StatusChip } from "@/components/admin/status-chip";
import { AgeBadge } from "@/components/admin/age-badge";
import { RunStrip, type RunStripItem } from "@/components/admin/run-strip";
import { RunNowButton } from "./run-now-button";

interface ScraperRun {
  id: string;
  source_platform: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  tournaments_found: number;
  tournaments_new: number;
  tournaments_updated: number;
  tournaments_deduplicated: number;
  error_message: string | null;
}

const HOUR = 3_600_000;
const STALE_MS = 3 * HOUR;
const DOWN_MS = 24 * HOUR;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function duration(start: string, end: string | null): string {
  if (!end) return "running…";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs.toString().padStart(2, "0")}s`;
}

/** Per-source health verdict from staleness + last-run outcome. */
function sourceStatus(
  lastRun: ScraperRun,
  lastSuccess: ScraperRun | undefined
): AdminStatus {
  const sinceSuccess = lastSuccess
    ? Date.now() - new Date(lastSuccess.started_at).getTime()
    : Infinity;
  const lastErrored = lastRun.status === "error";

  // Down: nothing succeeded in a day, or the last run errored AND we're past stale.
  if (sinceSuccess >= DOWN_MS) return "critical";
  if (lastErrored && sinceSuccess >= STALE_MS) return "critical";
  // Degraded: a recent failure, or success aging past the 3h cadence.
  if (lastErrored || sinceSuccess >= STALE_MS) return "attention";
  return "healthy";
}

export default async function ScrapingPage() {
  const supabase = getSupabaseAdmin();

  // Fetch last 50 runs (newest first).
  const { data: runs } = await supabase
    .from("scraper_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(50);

  const allRuns = (runs ?? []) as ScraperRun[];

  // Group runs by source (newest first within each group).
  const sourceMap = new Map<string, ScraperRun[]>();
  for (const run of allRuns) {
    const list = sourceMap.get(run.source_platform) ?? [];
    list.push(run);
    sourceMap.set(run.source_platform, list);
  }

  // 24h throughput context (kept muted/secondary).
  const oneDayAgo = new Date(Date.now() - DOWN_MS).toISOString();
  const recentRuns = allRuns.filter((r) => r.started_at > oneDayAgo);
  const stats24h = {
    runs: recentRuns.length,
    found: recentRuns.reduce((s, r) => s + r.tournaments_found, 0),
    new: recentRuns.reduce((s, r) => s + r.tournaments_new, 0),
    updated: recentRuns.reduce((s, r) => s + r.tournaments_updated, 0),
    deduped: recentRuns.reduce((s, r) => s + r.tournaments_deduplicated, 0),
    errors: recentRuns.filter((r) => r.status === "error").length,
  };

  // Per-source health model.
  const sources = Array.from(sourceMap.entries())
    .map(([name, srcRuns]) => {
      const lastRun = srcRuns[0];
      const lastSuccess = srcRuns.find((r) => r.status === "success");
      // Consecutive failures at the head of the list (newest-first).
      let consecutiveFails = 0;
      for (const r of srcRuns) {
        if (r.status === "error") consecutiveFails++;
        else break;
      }
      const window = srcRuns.slice(0, 30);
      const okCount = window.filter((r) => r.status === "success").length;
      // Strip wants oldest → newest.
      const strip: RunStripItem[] = window
        .map(
          (r): RunStripItem => ({
            status: r.status === "error" ? "error" : "success",
          })
        )
        .reverse();
      const status = sourceStatus(lastRun, lastSuccess);
      const latestError = srcRuns.find(
        (r) => r.status === "error" && r.error_message
      );
      return {
        name,
        lastRun,
        lastSuccess,
        consecutiveFails,
        windowCount: window.length,
        okCount,
        strip,
        status,
        latestError,
      };
    })
    // Worst sources first so problems lead.
    .sort(
      (a, b) =>
        ({ critical: 0, attention: 1, healthy: 2 })[a.status] -
        ({ critical: 0, attention: 1, healthy: 2 })[b.status]
    );

  const overall = worstStatus(...sources.map((s) => s.status));

  // Banner chips name the specific broken source(s).
  const problemChips: ProblemChip[] = sources
    .filter((s) => s.status !== "healthy")
    .map((s) => ({
      label:
        s.status === "critical"
          ? `${s.name} · down`
          : `${s.name} · ${s.lastRun.status === "error" ? "last run failed" : "stale"}`,
      level: s.status,
    }));

  const worstSource = sources.find((s) => s.status !== "healthy");
  const bannerTitle =
    sources.length === 0
      ? "No scraper runs recorded yet"
      : overall === "healthy"
        ? `All ${sources.length} source${sources.length === 1 ? "" : "s"} healthy`
        : worstSource
          ? `${problemChips.length} source${problemChips.length === 1 ? "" : "s"} need${problemChips.length === 1 ? "s" : ""} attention — ${worstSource.name} ${worstSource.status === "critical" ? "is down" : "is degraded"}`
          : "Scraper attention needed";

  return (
    <>
      {/* Page head */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[25px] font-extrabold tracking-tight text-emerald-950">
            Scraping Health
          </h1>
          <p className="mt-0.5 text-[13px] text-emerald-900/45">
            {sources.length} source{sources.length === 1 ? "" : "s"} monitored ·
            last 50 runs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/mostlyerror/pickleradar/actions/workflows/scrape.yml"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/15 bg-white px-4 py-2 text-sm font-bold text-emerald-900 transition hover:border-emerald-900/30"
          >
            Workflow logs ↗
          </a>
          <RunNowButton label="Run all sources" />
        </div>
      </div>

      {/* Verdict banner — worst across sources */}
      <AttentionBanner
        state={overall}
        title={bannerTitle}
        chips={problemChips}
        action={
          worstSource ? (
            <RunNowButton
              source={worstSource.name}
              label={`Re-run ${worstSource.name}`}
              variant={worstSource.status === "critical" ? "alarm" : "primary"}
            />
          ) : undefined
        }
        className="mb-7"
      />

      {/* Source cards */}
      <SectionLabel>Sources</SectionLabel>
      {sources.length === 0 ? (
        <div className="mb-8 rounded-2xl border border-emerald-900/10 bg-white p-8 text-center text-sm text-emerald-900/50">
          No scraper runs recorded yet. Trigger a run to populate this view.
        </div>
      ) : (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          {sources.map((src) => {
            const tokens = ADMIN_STATUS[src.status];
            const isDown = src.status === "critical";
            const chipLabel =
              src.status === "critical"
                ? "Down"
                : src.status === "attention"
                  ? "Degraded"
                  : "Healthy";
            return (
              <div
                key={src.name}
                className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm ${
                  isDown
                    ? "border-red-200 shadow-red-900/5"
                    : "border-emerald-900/10"
                }`}
              >
                {isDown && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-4 left-0 w-1 rounded-r bg-red-500"
                  />
                )}

                {/* Card head */}
                <div className="mb-3.5 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[16.5px] font-extrabold tracking-tight text-emerald-950">
                      {src.name}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-emerald-900/40">
                      {src.windowCount} run{src.windowCount === 1 ? "" : "s"} in
                      window · {src.okCount}/{src.windowCount} ok
                    </div>
                  </div>
                  <StatusChip status={src.status} label={chipLabel} />
                </div>

                {/* Hero: last successful run */}
                <div className="mb-3.5 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-emerald-900/40">
                      Last successful run
                    </div>
                    <div
                      className={`mt-1 text-[34px] font-extrabold leading-none tracking-tight ${
                        isDown ? "text-red-600" : "text-emerald-950"
                      }`}
                    >
                      {src.lastSuccess
                        ? timeAgo(src.lastSuccess.started_at)
                        : "never"}
                    </div>
                    <div
                      className={`mt-1.5 text-[12px] ${isDown ? "text-red-700/80" : "text-emerald-900/55"}`}
                    >
                      Last run: {timeAgo(src.lastRun.started_at)} ·{" "}
                      <span
                        className={
                          src.lastRun.status === "error"
                            ? "font-bold text-red-700"
                            : "font-bold text-emerald-700"
                        }
                      >
                        {src.lastRun.status}
                      </span>
                      {src.lastRun.completed_at && (
                        <>
                          {" "}
                          · ran{" "}
                          {duration(
                            src.lastRun.started_at,
                            src.lastRun.completed_at
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <AgeBadge
                    timestamp={src.lastRun.started_at}
                    prefix="last run"
                    className="flex-none"
                  />
                </div>

                {/* Reliability strip */}
                {src.strip.length > 0 && (
                  <RunStrip
                    runs={src.strip}
                    caption={[
                      `${src.windowCount} runs ago`,
                      src.consecutiveFails > 0 ? (
                        <span className="font-semibold text-red-700">
                          {src.consecutiveFails} fail
                          {src.consecutiveFails === 1 ? "" : "s"} →
                        </span>
                      ) : (
                        <span className="font-semibold text-emerald-700">
                          {src.okCount}/{src.windowCount} ok
                        </span>
                      ),
                    ]}
                    className="mb-3.5"
                  />
                )}

                {/* Latest error inline */}
                {src.latestError && src.status !== "healthy" && (
                  <div className="mb-3.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
                    <div className="mb-1 flex justify-between text-[11px] font-bold text-red-700">
                      <span>
                        ERROR · {timeAgo(src.latestError.started_at)}
                      </span>
                      {src.consecutiveFails > 1 && (
                        <span>repeated ×{src.consecutiveFails}</span>
                      )}
                    </div>
                    <p className="break-words font-mono text-[12px] leading-snug text-red-800/90">
                      {src.latestError.error_message}
                    </p>
                  </div>
                )}

                {/* Last-success stat row */}
                <div className="mb-4 flex border-t border-emerald-900/10 pt-3.5">
                  {[
                    {
                      label: "Found",
                      value: src.lastSuccess?.tournaments_found,
                      cls: "text-emerald-950",
                    },
                    {
                      label: "New",
                      value: src.lastSuccess?.tournaments_new,
                      cls: "text-emerald-600",
                    },
                    {
                      label: "Updated",
                      value: src.lastSuccess?.tournaments_updated,
                      cls: "text-blue-600",
                    },
                    {
                      label: "Deduped",
                      value: src.lastSuccess?.tournaments_deduplicated,
                      cls: "text-amber-600",
                    },
                  ].map((st, i, arr) => (
                    <div
                      key={st.label}
                      className={`flex-1 text-center ${i < arr.length - 1 ? "border-r border-emerald-900/10" : ""}`}
                    >
                      <div
                        className={`text-[18px] font-extrabold tracking-tight ${
                          src.lastSuccess ? st.cls : "text-emerald-900/25"
                        }`}
                      >
                        {src.lastSuccess ? st.value : "—"}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-emerald-900/40">
                        {st.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scoped action */}
                <div className="flex items-center gap-2">
                  <RunNowButton
                    source={src.name}
                    label="Re-run this source"
                    size="sm"
                    variant={isDown ? "alarm" : "calm"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 24h throughput context — muted/secondary */}
      <SectionLabel>Last 24 hours · throughput</SectionLabel>
      <div className="mb-8 grid grid-cols-3 gap-3 rounded-2xl border border-emerald-900/10 bg-white p-4 sm:grid-cols-6">
        {[
          { label: "Runs", value: stats24h.runs, cls: "text-emerald-900/70" },
          { label: "Found", value: stats24h.found, cls: "text-emerald-900/70" },
          { label: "New", value: stats24h.new, cls: "text-emerald-600" },
          { label: "Updated", value: stats24h.updated, cls: "text-blue-600" },
          { label: "Deduped", value: stats24h.deduped, cls: "text-amber-600" },
          {
            label: "Errors",
            value: stats24h.errors,
            cls: stats24h.errors > 0 ? "text-red-600" : "text-emerald-900/70",
          },
        ].map((st) => (
          <div key={st.label} className="text-center">
            <div className={`text-[22px] font-extrabold tracking-tight ${st.cls}`}>
              {st.value}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-emerald-900/40">
              {st.label}
            </div>
          </div>
        ))}
      </div>

      {/* Run history */}
      <SectionLabel>Run history · last {allRuns.length}</SectionLabel>
      {allRuns.length === 0 ? (
        <div className="rounded-2xl border border-emerald-900/10 bg-white p-8 text-center text-sm text-emerald-900/50">
          No runs yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white">
          <div className="flex items-center justify-between border-b border-emerald-900/10 px-4 py-3">
            <span className="text-[13px] font-bold text-emerald-950">
              All runs
            </span>
            <span className="text-xs text-emerald-900/40">
              {stats24h.errors} error{stats24h.errors === 1 ? "" : "s"} in last
              24h
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-emerald-900/10 text-[10.5px] font-bold uppercase tracking-[0.06em] text-emerald-900/40">
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Found</th>
                  <th className="px-4 py-3 text-right">New</th>
                  <th className="px-4 py-3 text-right">Updated</th>
                  <th className="px-4 py-3 text-right">Deduped</th>
                </tr>
              </thead>
              <tbody>
                {allRuns.map((run) => {
                  const errored = run.status === "error";
                  return (
                    <tr
                      key={run.id}
                      className={`border-b border-emerald-900/[0.06] last:border-0 ${errored ? "bg-red-50/40" : ""}`}
                    >
                      <td className="px-4 py-2.5 font-semibold text-emerald-950">
                        {run.source_platform}
                      </td>
                      <td className="px-4 py-2.5 text-emerald-900/55">
                        {timeAgo(run.started_at)}
                      </td>
                      <td className="px-4 py-2.5 text-emerald-900/55">
                        {duration(run.started_at, run.completed_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] ${
                            run.status === "success"
                              ? "bg-emerald-50 text-emerald-700"
                              : errored
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-emerald-900/70">
                        {errored ? (
                          <span className="text-emerald-900/25">—</span>
                        ) : (
                          run.tournaments_found
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                        {run.tournaments_new || (
                          <span className="text-emerald-900/25">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-blue-600">
                        {run.tournaments_updated || (
                          <span className="text-emerald-900/25">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-amber-600">
                        {run.tournaments_deduplicated || (
                          <span className="text-emerald-900/25">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <h3 className="text-[12px] font-bold uppercase tracking-[0.09em] text-emerald-900/40">
        {children}
      </h3>
      <span className="h-px flex-1 bg-emerald-900/10" />
    </div>
  );
}
