import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  worstStatus,
  ADMIN_STATUS,
  type AdminStatus,
} from "@/lib/admin-status";
import {
  AttentionBanner,
  type ProblemChip,
} from "@/components/admin/attention-banner";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusChip } from "@/components/admin/status-chip";
import { AgeBadge } from "@/components/admin/age-badge";
import { RunStrip, type RunStripItem } from "@/components/admin/run-strip";
import { RunNowButton } from "./scraping/run-now-button";
import { ReviewQueue, type PendingTournament } from "./review-queue";

interface ScraperRun {
  id: string;
  source_platform: string;
  started_at: string;
  status: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SCRAPER_STALE_MS = 3 * HOUR;
const SCRAPER_DOWN_MS = 24 * HOUR;
/** A submission is "aging" past 1 day, urgent past 3. */
const QUEUE_STALE_MS = DAY;
const QUEUE_CRITICAL_MS = 3 * DAY;

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

/** Calendar-day diff from today (today = 0, tomorrow = +1). */
function daysUntil(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / DAY);
}

function hasCoords(t: PendingTournament): boolean {
  return t.latitude != null && t.longitude != null;
}

/** Urgency score for a pending submission: lower sorts first. */
function urgencyKey(t: PendingTournament): number {
  // Primary: soonest start date (passed dates are most urgent of all).
  const days = daysUntil(t.date_start);
  // Secondary tiebreak: oldest submission first.
  const submittedAt = new Date(t.created_at).getTime();
  return days * 1e13 + submittedAt;
}

export default async function AdminPage() {
  const supabase = getSupabaseAdmin();

  const [
    { data: pending },
    { count: activeCount },
    { count: subscriberCount },
    { data: recentRuns },
    { count: activeGeocodeGaps },
  ] = await Promise.all([
    supabase
      .from("tournaments")
      .select("*")
      .eq("status", "pending_review")
      .order("created_at", { ascending: false }),
    supabase
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("scraper_runs")
      .select("id, source_platform, started_at, status")
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .is("latitude", null),
  ]);

  const tournaments = (pending ?? []) as PendingTournament[];
  const runs = (recentRuns ?? []) as ScraperRun[];

  // ── Sort the queue by urgency (soonest date, then oldest submission) ──
  const sortedQueue = [...tournaments].sort(
    (a, b) => urgencyKey(a) - urgencyKey(b)
  );

  // ── Scraper health (mirrors the scraping page's per-source model) ──
  const sourceMap = new Map<string, ScraperRun[]>();
  for (const r of runs) {
    const list = sourceMap.get(r.source_platform) ?? [];
    list.push(r);
    sourceMap.set(r.source_platform, list);
  }
  const sourceStatuses: { name: string; status: AdminStatus }[] = [];
  for (const [name, srcRuns] of sourceMap) {
    const lastRun = srcRuns[0];
    const lastSuccess = srcRuns.find((r) => r.status === "success");
    const sinceSuccess = lastSuccess
      ? Date.now() - new Date(lastSuccess.started_at).getTime()
      : Infinity;
    const lastErrored = lastRun.status === "error";
    let status: AdminStatus = "healthy";
    if (sinceSuccess >= SCRAPER_DOWN_MS) status = "critical";
    else if (lastErrored && sinceSuccess >= SCRAPER_STALE_MS) status = "critical";
    else if (lastErrored || sinceSuccess >= SCRAPER_STALE_MS) status = "attention";
    sourceStatuses.push({ name, status });
  }
  const scraperStatus = worstStatus(...sourceStatuses.map((s) => s.status));
  const lastRunOverall = runs[0] ?? null;
  const scraperStrip: RunStripItem[] = runs
    .slice(0, 12)
    .map(
      (r): RunStripItem => ({
        status: r.status === "error" ? "error" : "success",
      })
    )
    .reverse();
  const brokenSources = sourceStatuses.filter((s) => s.status !== "healthy");

  // ── Aging review queue ──
  const now = Date.now();
  const agingQueue = tournaments.filter((t) => {
    const age = now - new Date(t.created_at).getTime();
    const days = daysUntil(t.date_start);
    // Critical if it has waited long OR its date is near/passed.
    return age >= QUEUE_STALE_MS || days <= 7;
  });
  const queueCritical = tournaments.some((t) => {
    const age = now - new Date(t.created_at).getTime();
    const days = daysUntil(t.date_start);
    return age >= QUEUE_CRITICAL_MS || days <= 3;
  });
  const queueStatus: AdminStatus =
    tournaments.length === 0
      ? "healthy"
      : queueCritical
        ? "critical"
        : agingQueue.length > 0
          ? "attention"
          : "healthy";
  const oldestPending = sortedQueue.length
    ? [...tournaments].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )[0]
    : null;

  // ── Geocode gaps (pending + active that won't show on the map) ──
  const pendingGaps = tournaments.filter((t) => !hasCoords(t));
  const activeGaps = activeGeocodeGaps ?? 0;
  const totalGaps = pendingGaps.length + activeGaps;
  const geocodeStatus: AdminStatus =
    totalGaps === 0 ? "healthy" : totalGaps >= 5 ? "critical" : "attention";
  const pendingGeocodedPct =
    tournaments.length === 0
      ? 100
      : Math.round(
          ((tournaments.length - pendingGaps.length) / tournaments.length) * 100
        );

  // ── Worst-of system banner ──
  const overall = worstStatus(scraperStatus, queueStatus, geocodeStatus);

  const chips: ProblemChip[] = [];
  if (scraperStatus !== "healthy") {
    const broken = brokenSources[0];
    chips.push({
      label: lastRunOverall
        ? `Scraper ${scraperStatus === "critical" ? "down" : "stale"} — ${broken?.name ?? "source"} last ran ${timeAgo(lastRunOverall.started_at)}`
        : "No scraper runs recorded",
      level: scraperStatus,
      href: "/admin/scraping",
    });
  }
  if (queueStatus !== "healthy") {
    chips.push({
      label: `${agingQueue.length} submission${agingQueue.length === 1 ? "" : "s"} ${queueCritical ? "urgent / aging" : "aging"}`,
      level: queueStatus,
      href: "#queue",
    });
  }
  if (geocodeStatus !== "healthy") {
    chips.push({
      label: `${totalGaps} missing geocode${pendingGaps.length ? ` (${pendingGaps.length} pending)` : ""}`,
      level: geocodeStatus,
      href: "#queue",
    });
  }

  const bannerTitle =
    overall === "healthy"
      ? "All systems healthy"
      : `${chips.length} thing${chips.length === 1 ? "" : "s"} need${chips.length === 1 ? "s" : ""} you before ${chips.length === 1 ? "it rots" : "they rot"}`;

  // Triage rail verdict labels.
  const scraperVerdictLabel =
    scraperStatus === "critical"
      ? "Stale"
      : scraperStatus === "attention"
        ? "Degraded"
        : "Healthy";
  const queueVerdictLabel =
    queueStatus === "critical"
      ? "Urgent"
      : queueStatus === "attention"
        ? "Aging"
        : tournaments.length === 0
          ? "Clear"
          : "On pace";

  const soonCount = tournaments.filter(
    (t) => daysUntil(t.date_start) <= 7
  ).length;

  return (
    <>
      <AdminPageHeader
        title="Review"
        subtitle="Triage incoming submissions and keep the catalog healthy."
      />

      {/* ── System-status banner (full-bleed across the top) ── */}
      <AttentionBanner
        state={overall}
        title={bannerTitle}
        chips={chips}
        action={
          scraperStatus !== "healthy" ? (
            <RunNowButton
              label="Run scraper now"
              variant={scraperStatus === "critical" ? "alarm" : "primary"}
            />
          ) : undefined
        }
        className="mb-5 lg:mb-6"
      />

      {/* ──────────────────────────────────────────────────────────────
          COCKPIT: triage rail + wide queue.
          · base  — rail cards stack above the queue (mobile cards)
          · lg    — rail becomes a 3-across row above a full-width queue
          · xl    — rail folds into a sticky 360px left column beside the
                    wide table (full-bleed desktop, per admin-desktop.html)
         ────────────────────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start xl:gap-6">
        {/* ── Triage rail ── */}
        <aside className="flex flex-col gap-4 xl:sticky xl:top-[72px]">
          <div className="t-label font-extrabold tracking-[0.1em] text-emerald-900/35 lg:-mb-1">
            Needs you now
          </div>
          <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-1">

          {/* Review queue */}
          <TriageCard
            label="Review queue"
            verdict={queueStatus}
            verdictLabel={queueVerdictLabel}
            jumpHref="#queue"
            jumpLabel="Review →"
          >
            <BigNum value={tournaments.length} unit="waiting" />
            {oldestPending ? (
              <p className="t-small mt-2 leading-snug text-emerald-900/65">
                Oldest sat{" "}
                <span className="font-bold text-emerald-950">
                  {timeAgo(oldestPending.created_at)}
                </span>
                {soonCount > 0 && (
                  <>
                    {" · "}
                    <span className="font-bold text-emerald-950">
                      {soonCount}
                    </span>{" "}
                    start{soonCount === 1 ? "s" : ""} within a week
                  </>
                )}
              </p>
            ) : (
              <p className="t-small mt-2 text-emerald-900/55">
                Queue is clear — nothing waiting.
              </p>
            )}
            {oldestPending && (
              <AgeBadge
                timestamp={oldestPending.created_at}
                prefix="oldest"
                staleMs={QUEUE_STALE_MS}
                criticalMs={QUEUE_CRITICAL_MS}
                className="mt-2.5"
              />
            )}
          </TriageCard>

          {/* Scraper pipeline */}
          <TriageCard
            label="Scraper pipeline"
            verdict={scraperStatus}
            verdictLabel={scraperVerdictLabel}
            jumpHref="/admin/scraping"
            jumpLabel="Scraping →"
          >
            {lastRunOverall ? (
              <>
                <div className="flex items-center gap-3">
                  <StatusChip
                    status={
                      lastRunOverall.status === "error" ? "critical" : "healthy"
                    }
                    label={
                      lastRunOverall.status === "error" ? "Failed" : "Success"
                    }
                  />
                  <span className="t-small text-emerald-900/55">
                    last run{" "}
                    <span className="font-bold text-emerald-950">
                      {timeAgo(lastRunOverall.started_at)}
                    </span>
                  </span>
                </div>
                {scraperStrip.length > 0 && (
                  <RunStrip
                    runs={scraperStrip}
                    caption={[
                      `last ${scraperStrip.length} runs`,
                      `${sourceStatuses.length} source${sourceStatuses.length === 1 ? "" : "s"}`,
                    ]}
                    className="mt-3"
                  />
                )}
                <AgeBadge
                  timestamp={lastRunOverall.started_at}
                  prefix="last run"
                  staleMs={SCRAPER_STALE_MS}
                  criticalMs={SCRAPER_DOWN_MS}
                  className="mt-2.5"
                />
              </>
            ) : (
              <p className="t-small mt-2 text-emerald-900/55">
                No runs recorded yet.
              </p>
            )}
          </TriageCard>

          {/* Data quality */}
          <TriageCard
            label="Data quality"
            verdict={geocodeStatus}
            verdictLabel={totalGaps === 0 ? "Clean" : `${totalGaps} gaps`}
            jumpHref="#queue"
            jumpLabel="Fix geocode →"
          >
            <div className="flex items-center gap-3.5">
              <GeocodeRing pct={pendingGeocodedPct} status={geocodeStatus} />
              <p className="t-small min-w-0 leading-snug text-emerald-900/65">
                {totalGaps === 0 ? (
                  "Every tournament has coordinates — all mappable."
                ) : (
                  <>
                    <span className="font-bold text-emerald-950">
                      {pendingGaps.length}
                    </span>{" "}
                    of {tournaments.length} pending have no coordinates — won&apos;t
                    appear on the map until fixed.
                    {activeGaps > 0 && (
                      <>
                        {" "}
                        <span className="font-bold text-emerald-950">
                          {activeGaps}
                        </span>{" "}
                        live but off-map.
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
          </TriageCard>
          </div>
        </aside>

        {/* ── Wide pending review queue (urgency-sorted, inline approve/edit) ── */}
        <section id="queue" className="min-w-0 scroll-mt-[64px]">
          <ReviewQueue items={sortedQueue} />

          {/* ── Demoted vanity / context strip ── */}
          <div className="mt-8 grid gap-5 border-t border-emerald-900/10 pt-5 sm:grid-cols-3">
            <ContextStat
              title="Catalog"
              value={activeCount ?? 0}
              label="active tournaments"
            />
            <ContextStat
              title="Audience"
              value={subscriberCount ?? 0}
              label="subscribers"
            />
            <div>
              <div className="t-label mb-2 font-extrabold tracking-[0.1em] text-emerald-900/35">
                Scraper · recent
              </div>
              <div className="t-small text-emerald-900/60">
                {runs.length} run{runs.length === 1 ? "" : "s"} tracked ·{" "}
                <span className="font-bold text-emerald-900/80">
                  {sourceStatuses.length}
                </span>{" "}
                source{sourceStatuses.length === 1 ? "" : "s"}
                {lastRunOverall && (
                  <> · last {timeAgo(lastRunOverall.started_at)}</>
                )}
              </div>
              <Link
                href="/admin/scraping"
                className="t-caption mt-1 inline-block font-bold text-emerald-700 hover:text-emerald-800"
              >
                Pipeline detail →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function TriageCard({
  label,
  verdict,
  verdictLabel,
  jumpHref,
  jumpLabel,
  children,
}: {
  label: string;
  verdict: AdminStatus;
  verdictLabel: string;
  jumpHref: string;
  jumpLabel: string;
  children: React.ReactNode;
}) {
  const tokens = ADMIN_STATUS[verdict];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-900/10 bg-white p-4 pb-11">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="t-label font-extrabold text-emerald-900/40">
          {label}
        </span>
        <span
          className={`t-caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold ${tokens.bg} ${tokens.text}`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${tokens.dot}`}
          />
          {verdictLabel}
        </span>
      </div>
      {children}
      <Link
        href={jumpHref}
        className="t-caption absolute bottom-3.5 right-4 font-bold text-emerald-700 hover:text-emerald-800"
      >
        {jumpLabel}
      </Link>
    </div>
  );
}

/** Conic-gradient progress ring showing % of pending submissions geocoded. */
function GeocodeRing({ pct, status }: { pct: number; status: AdminStatus }) {
  const fill =
    status === "critical"
      ? "#dc2626"
      : status === "attention"
        ? "#d97706"
        : "#16a34a";
  return (
    <div
      className="grid h-[58px] w-[58px] flex-none place-items-center rounded-full"
      style={{
        background: `conic-gradient(${fill} ${pct}%, #eef1ec 0)`,
      }}
    >
      <div className="t-small grid h-[42px] w-[42px] place-items-center rounded-full bg-white font-extrabold text-emerald-950">
        {pct}%
      </div>
    </div>
  );
}

function BigNum({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="t-display text-emerald-950">
        {value}
      </span>
      <span className="t-body font-semibold text-emerald-900/45">
        {unit}
      </span>
    </div>
  );
}

function ContextStat({
  title,
  value,
  label,
}: {
  title: string;
  value: number;
  label: string;
}) {
  return (
    <div>
      <div className="t-label mb-2 font-extrabold tracking-[0.1em] text-emerald-900/35">
        {title}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="t-h1 text-emerald-900/75">
          {value.toLocaleString()}
        </span>
        <span className="t-caption text-emerald-900/45">{label}</span>
      </div>
    </div>
  );
}
