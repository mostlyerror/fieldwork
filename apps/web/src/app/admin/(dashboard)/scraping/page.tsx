import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  worstStatus,
  ADMIN_STATUS,
  type AdminStatus,
} from "@/lib/admin-status";
import { AttentionBanner, type ProblemChip } from "@/components/admin/attention-banner";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusChip } from "@/components/admin/status-chip";
import { RunStrip, type RunStripItem } from "@/components/admin/run-strip";
import { SOURCE_DISPLAY_NAMES } from "@/lib/constants";
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
  if (hours < 24) {
    const rem = mins % 60;
    return rem ? `${hours}h ${rem}m ago` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h ago` : `${days}d ago`;
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

  // 24h throughput context.
  const oneDayAgo = new Date(Date.now() - DOWN_MS).toISOString();
  const recentRuns = allRuns.filter((r) => r.started_at > oneDayAgo);
  const succeeded24h = recentRuns.filter((r) => r.status === "success").length;
  const errors24h = recentRuns.filter((r) => r.status === "error").length;
  const stats24h = {
    runs: recentRuns.length,
    succeeded: succeeded24h,
    failed: errors24h,
    new: recentRuns.reduce((s, r) => s + r.tournaments_new, 0),
    updated: recentRuns.reduce((s, r) => s + r.tournaments_updated, 0),
    deduped: recentRuns.reduce((s, r) => s + r.tournaments_deduplicated, 0),
    successRate:
      recentRuns.length > 0
        ? Math.round((succeeded24h / recentRuns.length) * 100)
        : null,
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
      <AdminPageHeader
        title="Scraping Health"
        subtitle={`${sources.length} source${sources.length === 1 ? "" : "s"} monitored · last ${allRuns.length} runs`}
        action={
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/mostlyerror/pickleradar/actions/workflows/scrape.yml"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-full border border-emerald-900/15 bg-white px-4 py-2 t-body font-bold text-emerald-900 transition hover:border-emerald-900/30 sm:inline-flex"
            >
              Workflow logs ↗
            </a>
            <RunNowButton label="Run all sources" />
          </div>
        }
      />

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

      {/* 24h throughput */}
      <SectionLabel>Last 24h throughput</SectionLabel>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:mb-9 lg:grid-cols-6 lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-emerald-900/10 lg:bg-white lg:shadow-sm">
        {[
          {
            label: "Runs",
            value: stats24h.runs,
            cls: "text-emerald-950",
            sub: `across ${sources.length} source${sources.length === 1 ? "" : "s"}`,
          },
          {
            label: "Succeeded",
            value: stats24h.succeeded,
            cls: "text-emerald-700",
            sub:
              stats24h.successRate === null
                ? "no runs yet"
                : `${stats24h.successRate}% success rate`,
          },
          {
            label: "Failed",
            value: stats24h.failed,
            cls: stats24h.failed > 0 ? "text-red-600" : "text-emerald-950",
            sub:
              stats24h.failed > 0 ? "needs attention" : "all runs healthy",
          },
          {
            label: "New",
            value: stats24h.new,
            cls: "text-emerald-600",
            sub: "added to pipeline",
          },
          {
            label: "Updated",
            value: stats24h.updated,
            cls: "text-blue-600",
            sub: "existing records",
          },
          {
            label: "Deduped",
            value: stats24h.deduped,
            cls: "text-amber-600",
            sub: "cross-source merges",
          },
        ].map((st) => (
          <div
            key={st.label}
            className="flex flex-col gap-2 rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm lg:rounded-none lg:border-0 lg:border-r lg:border-emerald-900/10 lg:p-[18px] lg:shadow-none lg:last:border-r-0"
          >
            <div className={`text-[28px] font-extrabold leading-none tracking-tight lg:text-[25px] ${st.cls}`}>
              {st.value}
            </div>
            <div className="t-label text-emerald-900/50">
              {st.label}
            </div>
            <div className="t-caption text-emerald-900/55">
              {st.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Source cards */}
      <SectionLabel>Sources</SectionLabel>
      {sources.length === 0 ? (
        <div className="mb-8 rounded-2xl border border-emerald-900/10 bg-white p-8 text-center t-body text-emerald-900/50">
          No scraper runs recorded yet. Trigger a run to populate this view.
        </div>
      ) : (
        <div className="mb-9 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 [@media(min-width:1700px)]:grid-cols-4">
          {sources.map((src) => {
            const tokens = ADMIN_STATUS[src.status];
            const isDown = src.status === "critical";
            const isDegraded = src.status === "attention";
            const chipLabel =
              src.status === "critical"
                ? "Down"
                : src.status === "attention"
                  ? "Degraded"
                  : "Healthy";
            return (
              <div
                key={src.name}
                className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white p-5 shadow-sm ${
                  isDown
                    ? "border-red-200 shadow-red-900/10"
                    : isDegraded
                      ? "border-amber-200"
                      : "border-emerald-900/10"
                }`}
              >
                {/* Status accent rail */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-1 ${
                    isDown
                      ? "bg-red-500"
                      : isDegraded
                        ? "bg-amber-500"
                        : "bg-emerald-200"
                  }`}
                />

                {/* Card head */}
                <div className="mb-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate t-h3 font-extrabold text-emerald-950">
                      {SOURCE_DISPLAY_NAMES[src.name] ?? src.name}
                    </div>
                    <div className="mt-1 t-caption text-emerald-900/40">
                      {src.windowCount} run{src.windowCount === 1 ? "" : "s"} in
                      window · {src.okCount}/{src.windowCount} ok
                    </div>
                  </div>
                  <StatusChip status={src.status} label={chipLabel} />
                </div>

                {/* Hero: last successful run */}
                <div className="mb-3.5 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="t-label text-emerald-900/45">
                      Last successful run
                    </div>
                    <div
                      className={`mt-2 text-[34px] font-extrabold leading-none tracking-tight ${
                        isDown
                          ? "text-red-600"
                          : isDegraded
                            ? "text-amber-600"
                            : "text-emerald-950"
                      }`}
                    >
                      {src.lastSuccess
                        ? timeAgo(src.lastSuccess.started_at)
                        : "never"}
                    </div>
                    <div
                      className={`mt-2 min-h-[2.5em] t-caption leading-tight ${isDown ? "text-red-700/80" : "text-emerald-900/55"}`}
                    >
                      Last run {timeAgo(src.lastRun.started_at)} ·{" "}
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
                          {" · ran "}
                          {duration(
                            src.lastRun.started_at,
                            src.lastRun.completed_at
                          )}
                        </>
                      )}
                    </div>
                  </div>
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
                    <div className="mb-1.5 flex justify-between gap-2 t-caption font-bold text-red-700">
                      <span>ERROR · {timeAgo(src.latestError.started_at)}</span>
                      {src.consecutiveFails > 1 && (
                        <span className="flex-none">
                          repeated ×{src.consecutiveFails}
                        </span>
                      )}
                    </div>
                    <p className="break-words font-mono t-caption leading-snug text-red-800/90">
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
                        className={`t-h2 font-extrabold ${
                          src.lastSuccess ? st.cls : "text-emerald-900/25"
                        }`}
                      >
                        {src.lastSuccess ? st.value : "—"}
                      </div>
                      <div className="mt-0.5 t-label font-semibold text-emerald-900/40">
                        {st.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scoped action — pinned to card bottom */}
                <div className="mt-auto">
                  <RunNowButton
                    source={src.name}
                    label="Re-run this source"
                    size="sm"
                    variant={isDown ? "alarm" : "calm"}
                    className="w-full justify-center sm:w-auto"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Run history */}
      <SectionLabel
        meta={
          allRuns.length > 0
            ? `${stats24h.failed} err / 24h`
            : undefined
        }
      >
        Run history · last {allRuns.length}
      </SectionLabel>
      {allRuns.length === 0 ? (
        <div className="rounded-2xl border border-emerald-900/10 bg-white p-8 text-center t-body text-emerald-900/50">
          No runs yet.
        </div>
      ) : (
        <>
          {/* Mobile: stacked run cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {allRuns.map((run) => {
              const errored = run.status === "error";
              return (
                <div
                  key={run.id}
                  className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm ${
                    errored ? "border-red-200" : "border-emerald-900/10"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1 ${errored ? "bg-red-500" : "bg-emerald-200"}`}
                  />
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="truncate t-body font-bold text-emerald-950">
                      {run.source_platform}
                    </span>
                    <StatusPill status={run.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 t-small text-emerald-900/60">
                    <span>{timeAgo(run.started_at)}</span>
                    <span>{duration(run.started_at, run.completed_at)}</span>
                    {errored ? (
                      <span className="text-emerald-900/35">— found</span>
                    ) : (
                      <>
                        <span>
                          <b className="font-bold text-emerald-900/80">
                            {run.tournaments_found}
                          </b>{" "}
                          found
                        </span>
                        <span>
                          <b className="font-bold text-emerald-600">
                            {run.tournaments_new}
                          </b>{" "}
                          new
                        </span>
                        <span>
                          <b className="font-bold text-blue-600">
                            {run.tournaments_updated}
                          </b>{" "}
                          upd
                        </span>
                        <span>
                          <b className="font-bold text-amber-600">
                            {run.tournaments_deduplicated}
                          </b>{" "}
                          dedup
                        </span>
                      </>
                    )}
                  </div>
                  {errored && run.error_message && (
                    <div className="mt-3 break-words rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 font-mono t-caption leading-snug text-red-800/90">
                      {run.error_message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: wide table */}
          <div className="hidden overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm lg:block">
            <div className="flex items-center justify-between border-b border-emerald-900/10 px-5 py-3.5">
              <span className="t-small font-bold text-emerald-950">
                All runs
              </span>
              <span className="t-caption text-emerald-900/40">
                {stats24h.failed} error{stats24h.failed === 1 ? "" : "s"} in last
                24h
              </span>
            </div>
            <table className="w-full text-left t-small">
              <thead>
                <tr className="border-b border-emerald-900/10 t-label text-emerald-900/40">
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Found</th>
                  <th className="px-5 py-3 text-right">New</th>
                  <th className="px-5 py-3 text-right">Updated</th>
                  <th className="px-5 py-3 text-right">Deduped</th>
                </tr>
              </thead>
              <tbody>
                {allRuns.map((run) => {
                  const errored = run.status === "error";
                  return [
                    <tr
                      key={run.id}
                      className={`border-b border-emerald-900/[0.06] last:border-0 ${errored ? "bg-red-50/40" : ""}`}
                    >
                      <td className="px-5 py-2.5 font-semibold text-emerald-950">
                        {run.source_platform}
                      </td>
                      <td className="px-5 py-2.5 text-emerald-900/55">
                        {timeAgo(run.started_at)}
                      </td>
                      <td className="px-5 py-2.5 text-emerald-900/55">
                        {duration(run.started_at, run.completed_at)}
                      </td>
                      <td className="px-5 py-2.5">
                        <StatusPill status={run.status} />
                      </td>
                      <td className="px-5 py-2.5 text-right text-emerald-900/70">
                        {errored ? (
                          <span className="text-emerald-900/25">—</span>
                        ) : (
                          run.tournaments_found
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right font-bold text-emerald-600">
                        {errored ? (
                          <span className="text-emerald-900/25">—</span>
                        ) : (
                          run.tournaments_new || (
                            <span className="text-emerald-900/25">—</span>
                          )
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right text-blue-600">
                        {errored ? (
                          <span className="text-emerald-900/25">—</span>
                        ) : (
                          run.tournaments_updated || (
                            <span className="text-emerald-900/25">—</span>
                          )
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right text-amber-600">
                        {errored ? (
                          <span className="text-emerald-900/25">—</span>
                        ) : (
                          run.tournaments_deduplicated || (
                            <span className="text-emerald-900/25">—</span>
                          )
                        )}
                      </td>
                    </tr>,
                    errored && run.error_message ? (
                      <tr key={`${run.id}-err`} className="bg-red-50/40">
                        <td
                          colSpan={8}
                          className="px-5 pb-3 pt-0 font-mono t-caption leading-snug text-red-800/85"
                        >
                          {run.error_message}
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/** Status pill shared by the mobile run cards and the desktop history table. */
function StatusPill({ status }: { status: string }) {
  const errored = status === "error";
  const success = status === "success";
  return (
    <span
      className={`inline-block flex-none rounded-full px-2 py-0.5 t-label ${
        success
          ? "bg-emerald-50 text-emerald-700"
          : errored
            ? "bg-red-50 text-red-700"
            : "bg-amber-50 text-amber-700"
      }`}
    >
      {status}
    </span>
  );
}

function SectionLabel({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <h3 className="t-label text-emerald-900/40">
        {children}
      </h3>
      <span className="h-px flex-1 bg-emerald-900/10" />
      {meta && (
        <span className="flex-none t-small font-semibold text-emerald-900/40">
          {meta}
        </span>
      )}
    </div>
  );
}
