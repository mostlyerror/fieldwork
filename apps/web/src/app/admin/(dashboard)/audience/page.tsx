import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { AttentionBanner } from "@/components/admin/attention-banner";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SocialQueue, type SocialPost } from "@/components/admin/social-queue";
import {
  SubscriberTable,
  type Subscriber,
} from "@/components/admin/subscriber-table";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Build last-12-week net-add series + this/last week deltas from join dates. */
function weeklySeries(dates: string[]) {
  const now = Date.now();
  const buckets = new Array(12).fill(0);
  for (const d of dates) {
    const age = now - new Date(d).getTime();
    if (age < 0) continue;
    const weeksAgo = Math.floor(age / WEEK_MS);
    if (weeksAgo < 12) buckets[11 - weeksAgo] += 1; // oldest → newest
  }
  return buckets;
}

/** SVG area + line path for a small sparkline given a value series. */
function sparkPaths(series: number[], w: number, h: number) {
  const max = Math.max(1, ...series);
  const n = series.length;
  const pts = series.map((v, i) => {
    const x = n === 1 ? w : (i / (n - 1)) * w;
    const y = h - 6 - (v / max) * (h - 12);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const last = pts[pts.length - 1];
  return { line, area, last };
}

export default async function AudiencePage() {
  const db = getSupabaseAdmin();
  const now = Date.now();
  const sevenDaysAgo = new Date(now - WEEK_MS).toISOString();
  const fourteenDaysAgo = new Date(now - 2 * WEEK_MS).toISOString();
  const twelveWeeksAgo = new Date(now - 12 * WEEK_MS).toISOString();

  const [
    { data: actionable },
    { data: recent },
    { data: subscribers },
    { count: totalCount },
    { count: activeCount },
    { count: unsubscribedCount },
    { count: newThisWeek },
    { count: newLastWeek },
    { data: joinWindow },
  ] = await Promise.all([
    db
      .from("social_posts")
      .select("*")
      .in("status", ["queued", "failed"])
      .order("created_at", { ascending: false }),
    db
      .from("social_posts")
      .select("*")
      .in("status", ["published", "rejected"])
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("email_subscribers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("email_subscribers")
      .select("*", { count: "exact", head: true }),
    db
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    db
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "unsubscribed"),
    db
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    db
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .gte("created_at", fourteenDaysAgo)
      .lt("created_at", sevenDaysAgo),
    db
      .from("email_subscribers")
      .select("created_at")
      .gte("created_at", twelveWeeksAgo)
      .limit(5000),
  ]);

  const actionablePosts = (actionable ?? []) as SocialPost[];
  const recentPosts = (recent ?? []) as SocialPost[];
  const allSubscribers = (subscribers ?? []) as Subscriber[];

  const total = totalCount ?? 0;
  const active = activeCount ?? 0;
  const unsubscribed = unsubscribedCount ?? 0;
  const newWk = newThisWeek ?? 0;
  const newPrevWk = newLastWeek ?? 0;

  const failedCount = actionablePosts.filter((p) => p.status === "failed").length;
  const queuedCount = actionablePosts.filter((p) => p.status === "queued").length;

  // Oldest waiting post → human "Xd"
  let oldestLabel: string | null = null;
  if (actionablePosts.length > 0) {
    const oldest = actionablePosts.reduce((a, b) =>
      new Date(a.created_at) < new Date(b.created_at) ? a : b
    );
    const ageMs = now - new Date(oldest.created_at).getTime();
    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor(ageMs / (60 * 60 * 1000));
    oldestLabel = days >= 1 ? `${days}d` : `${hours}h`;
  }

  // Growth sparkline series (last 12 weeks net adds)
  const series = weeklySeries(((joinWindow ?? []) as { created_at: string }[]).map((r) => r.created_at));
  const spark = sparkPaths(series, 320, 96);

  // Active growth % vs the active count a week ago (active − net new this wk)
  const activeLastWk = Math.max(0, active - newWk);
  const growthPct = activeLastWk > 0 ? (newWk / activeLastWk) * 100 : 0;

  const newDelta = newWk - newPrevWk;

  const hasAttention = failedCount > 0 || queuedCount > 0;

  return (
    <div className="space-y-7">
      <AdminPageHeader
        title="Audience"
        subtitle={`${active} active subscriber${active === 1 ? "" : "s"} · ${newWk} new this week`}
      />

      {/* ── ATTENTION BANNER (needs you now) ─────────────────────────── */}
      <AttentionBanner
        state={failedCount > 0 ? "critical" : queuedCount > 0 ? "attention" : "healthy"}
        title={
          hasAttention ? (
            <>
              {failedCount > 0 && (
                <span className="text-red-700">
                  {failedCount} failed publish{failedCount !== 1 && "es"}
                </span>
              )}
              {failedCount > 0 && queuedCount > 0 && " · "}
              {queuedCount > 0 && <>{queuedCount} awaiting review</>}
            </>
          ) : (
            "Queue clear — nothing waiting on you"
          )
        }
        chips={
          hasAttention
            ? [
                ...(failedCount > 0
                  ? [{ label: `${failedCount} Failed`, level: "critical" as const }]
                  : []),
                ...(queuedCount > 0
                  ? [{ label: `${queuedCount} Queued`, level: "attention" as const }]
                  : []),
                ...(oldestLabel
                  ? [{ label: `${oldestLabel} Oldest waiting`, level: "attention" as const }]
                  : []),
              ]
            : []
        }
      />

      {/* ── AUDIENCE HERO BAND (hero number | growth viz | tiles) ─────── */}
      <div className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm lg:grid lg:grid-cols-[minmax(260px,1.1fr)_minmax(380px,2fr)_minmax(300px,1.1fr)]">
        {/* hero number */}
        <div className="border-b border-emerald-900/[0.07] p-6 lg:border-b-0 lg:border-r">
          <div className="t-label font-extrabold text-emerald-900/40">
            Active subscribers
          </div>
          <div className="mt-1 flex items-end gap-3">
            <div className="text-5xl font-extrabold tracking-tight text-emerald-950">
              {active.toLocaleString()}
            </div>
            {newWk > 0 && (
              <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 t-caption font-extrabold text-emerald-700">
                ▲ +{newWk} this wk · +{growthPct.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="mt-3 t-caption font-semibold text-emerald-900/40">
            {total.toLocaleString()} total on the email list ·{" "}
            {unsubscribed.toLocaleString()} unsubscribed all-time
          </p>
        </div>

        {/* growth sparkline */}
        <div className="border-b border-emerald-900/[0.07] p-6 lg:border-b-0 lg:border-r">
          <div className="mb-2 flex justify-between t-caption font-semibold text-emerald-900/40">
            <span>Weekly net adds</span>
            <span>last 12 weeks</span>
          </div>
          <svg
            className="block w-full"
            height={96}
            viewBox="0 0 320 96"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="audienceSpark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#16a34a" stopOpacity="0.22" />
                <stop offset="1" stopColor="#16a34a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={spark.area} fill="url(#audienceSpark)" />
            <path
              d={spark.line}
              fill="none"
              stroke="#16a34a"
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={spark.last[0]} cy={spark.last[1]} r="4" fill="#16a34a" />
          </svg>
        </div>

        {/* this week vs last week tiles */}
        <div className="p-6">
          <div className="mb-2 flex justify-between t-caption font-semibold text-emerald-900/40">
            <span>Growth</span>
            <span>vs last week</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="New this week"
              value={newWk}
              delta={newDelta}
              good="up"
            />
            <StatTile
              label="Unsubscribed"
              value={unsubscribed}
              good="down"
            />
          </div>
        </div>
      </div>

      {/* ── WORK AREA: queue (left) + subscriber table (right) ────────── */}
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <SocialQueue actionable={actionablePosts} recent={recentPosts} />
        <SubscriberTable subscribers={allSubscribers} total={total} />
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  delta,
  good,
}: {
  label: string;
  value: number;
  /** Omit when no reliable week-over-week comparison exists. */
  delta?: number;
  /** Which direction is "good" (green). */
  good: "up" | "down";
}) {
  let tone = "text-emerald-900/40";
  let arrow = "▲";
  if (delta !== undefined && delta !== 0) {
    const isUp = delta > 0;
    arrow = isUp ? "▲" : "▼";
    const isGood = good === "up" ? isUp : !isUp;
    tone = isGood ? "text-emerald-700" : "text-red-700";
  }
  return (
    <div className="rounded-xl border border-emerald-900/10 p-3.5">
      <div className="t-label text-emerald-900/40">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="t-h1 text-emerald-950">
          {value}
        </span>
        <span className={`t-caption font-extrabold ${tone}`}>
          {delta !== undefined && delta !== 0
            ? `${arrow} ${delta > 0 ? "+" : ""}${delta}`
            : delta === undefined
              ? "all-time"
              : "—"}
        </span>
      </div>
    </div>
  );
}
