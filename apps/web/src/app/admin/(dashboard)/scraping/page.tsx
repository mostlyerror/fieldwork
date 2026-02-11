import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { triggerScraper } from "./actions";

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
  if (!end) return "running...";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

export default async function ScrapingPage() {
  const supabase = getSupabaseAdmin();

  // Fetch last 50 runs
  const { data: runs } = await supabase
    .from("scraper_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(50);

  const allRuns = (runs ?? []) as ScraperRun[];

  // Last run per source
  const sourceMap = new Map<string, ScraperRun[]>();
  for (const run of allRuns) {
    const list = sourceMap.get(run.source_platform) ?? [];
    list.push(run);
    sourceMap.set(run.source_platform, list);
  }

  // Overall last run
  const lastRun = allRuns[0] ?? null;
  const lastSuccessful = allRuns.find((r) => r.status === "success") ?? null;
  const hoursSinceLastRun = lastRun
    ? (Date.now() - new Date(lastRun.started_at).getTime()) / 3600000
    : Infinity;
  const isStale = hoursSinceLastRun > 3;

  // Aggregate stats (last 24h)
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const recentRuns = allRuns.filter((r) => r.started_at > oneDayAgo);
  const stats24h = {
    runs: recentRuns.length,
    found: recentRuns.reduce((s, r) => s + r.tournaments_found, 0),
    new: recentRuns.reduce((s, r) => s + r.tournaments_new, 0),
    updated: recentRuns.reduce((s, r) => s + r.tournaments_updated, 0),
    deduped: recentRuns.reduce((s, r) => s + r.tournaments_deduplicated, 0),
    errors: recentRuns.filter((r) => r.status === "error").length,
  };

  // Sparkline data: new tournaments per run (last 20 completed runs, chronological)
  const sparklineRuns = allRuns
    .filter((r) => r.status === "success")
    .slice(0, 20)
    .reverse();
  const sparklineMax = Math.max(
    1,
    ...sparklineRuns.map((r) => r.tournaments_new)
  );

  // Source health
  const sources = Array.from(sourceMap.entries()).map(([name, runs]) => {
    const lastSuccess = runs.find((r) => r.status === "success");
    const recentErrors = runs
      .slice(0, 10)
      .filter((r) => r.status === "error").length;
    return {
      name,
      lastRun: runs[0],
      lastSuccess,
      recentErrorRate: recentErrors / Math.min(runs.length, 10),
      totalRuns: runs.length,
    };
  });

  // Error log (recent failures)
  const recentErrors = allRuns
    .filter((r) => r.status === "error" && r.error_message)
    .slice(0, 10);

  return (
    <>
      {/* Status banner */}
      <div
        className={`mb-8 rounded-2xl p-5 shadow-sm ring-1 ${
          isStale
            ? "bg-red-50 ring-red-200"
            : lastRun?.status === "error"
              ? "bg-amber-50 ring-amber-200"
              : "bg-green-50 ring-green-200"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  isStale
                    ? "bg-red-500"
                    : lastRun?.status === "error"
                      ? "bg-amber-500"
                      : "bg-green-500"
                }`}
              />
              <span className="text-sm font-bold text-gray-800">
                {isStale
                  ? "Scraper may be down"
                  : lastRun?.status === "error"
                    ? "Last run had errors"
                    : "Scraper healthy"}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Last run:{" "}
              {lastRun ? (
                <>
                  {timeAgo(lastRun.started_at)} ({lastRun.source_platform},{" "}
                  {lastRun.status})
                </>
              ) : (
                "never"
              )}
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await triggerScraper();
              redirect("/admin/scraping");
            }}
          >
            <button
              type="submit"
              className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
            >
              Run scraper now
            </button>
          </form>
        </div>
      </div>

      {/* 24h stats */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-gray-800">Last 24 Hours</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Runs", value: stats24h.runs, color: "text-gray-800" },
            {
              label: "Found",
              value: stats24h.found,
              color: "text-gray-800",
            },
            { label: "New", value: stats24h.new, color: "text-green-600" },
            {
              label: "Updated",
              value: stats24h.updated,
              color: "text-blue-600",
            },
            {
              label: "Deduped",
              value: stats24h.deduped,
              color: "text-amber-600",
            },
            {
              label: "Errors",
              value: stats24h.errors,
              color: stats24h.errors > 0 ? "text-red-600" : "text-gray-800",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {stat.label}
              </p>
              <p className={`mt-1 text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* New tournaments sparkline */}
      {sparklineRuns.length > 1 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-gray-800">
            New Tournaments per Run
          </h2>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-end gap-1" style={{ height: 80 }}>
              {sparklineRuns.map((run) => {
                const height = Math.max(
                  4,
                  (run.tournaments_new / sparklineMax) * 72
                );
                return (
                  <div
                    key={run.id}
                    className="group relative flex-1"
                    title={`${run.source_platform}: ${run.tournaments_new} new (${new Date(run.started_at).toLocaleDateString()})`}
                  >
                    <div
                      className="w-full rounded-t bg-green-400 transition group-hover:bg-green-500"
                      style={{ height }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-gray-400">
              <span>
                {new Date(sparklineRuns[0].started_at).toLocaleDateString()}
              </span>
              <span>
                {new Date(
                  sparklineRuns[sparklineRuns.length - 1].started_at
                ).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Source health */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-gray-800">Source Health</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {sources.map((src) => (
            <div
              key={src.name}
              className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">
                  {src.name}
                </span>
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    src.recentErrorRate > 0.5
                      ? "bg-red-500"
                      : src.recentErrorRate > 0
                        ? "bg-amber-500"
                        : "bg-green-500"
                  }`}
                />
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                <p>
                  Last success:{" "}
                  {src.lastSuccess
                    ? timeAgo(src.lastSuccess.started_at)
                    : "never"}
                </p>
                <p>
                  Last run: {timeAgo(src.lastRun.started_at)} ({src.lastRun.status})
                </p>
                {src.lastSuccess && (
                  <p>
                    Found {src.lastSuccess.tournaments_found}, new{" "}
                    {src.lastSuccess.tournaments_new}, deduped{" "}
                    {src.lastSuccess.tournaments_deduplicated}
                  </p>
                )}
                {src.recentErrorRate > 0 && (
                  <p className="text-red-500">
                    {Math.round(src.recentErrorRate * 100)}% error rate (last 10
                    runs)
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error log */}
      {recentErrors.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-gray-800">
            Recent Errors
          </h2>
          <div className="space-y-2">
            {recentErrors.map((run) => (
              <div
                key={run.id}
                className="rounded-xl bg-red-50 p-4 ring-1 ring-red-100"
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-red-400">
                  <span className="font-semibold">{run.source_platform}</span>
                  <span>{timeAgo(run.started_at)}</span>
                </div>
                <p className="font-mono text-xs text-red-700">
                  {run.error_message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run history table */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-gray-800">Run History</h2>
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-400">
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
              {allRuns.map((run) => (
                <tr
                  key={run.id}
                  className="border-b border-gray-50 last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium text-gray-700">
                    {run.source_platform}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {timeAgo(run.started_at)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {duration(run.started_at, run.completed_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        run.status === "success"
                          ? "bg-green-50 text-green-600"
                          : run.status === "error"
                            ? "bg-red-50 text-red-600"
                            : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {run.tournaments_found}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-green-600">
                    {run.tournaments_new || "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-blue-600">
                    {run.tournaments_updated || "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-amber-600">
                    {run.tournaments_deduplicated || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
