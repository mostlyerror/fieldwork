"use client";

/**
 * <SocialQueue> — the Instagram review queue for the /admin audience cockpit.
 *
 * Renders the actionable posts grouped into "Fix first — failed" (red) and
 * "Awaiting review" (amber) bands, plus a collapsible recent-history accordion.
 * Each queued/failed row is a compact card with a thumbnail, caption, status
 * meta and the real publish / retry / reject actions. Rows expand inline into a
 * caption editor (Save caption + Publish). Recent published/rejected posts show
 * as read-only history rows.
 *
 * All mutations reuse the existing audience server actions through
 * useOptimisticAction (toast + scoped error), then router.refresh() — no full
 * page reload. The same component renders mobile cards and the desktop column;
 * the layout differences are pure Tailwind responsive utilities.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  publishPost,
  rejectPost,
  retryPost,
  updatePostCaption,
} from "@/app/admin/(dashboard)/audience/actions";
import { useOptimisticAction } from "@/components/admin/use-optimistic-action";
import { AgeBadge } from "@/components/admin/age-badge";

export interface SocialPost {
  id: string;
  post_type: string;
  status: string;
  platform: string;
  caption: string;
  image_url: string;
  metadata: Record<string, unknown>;
  published_at: string | null;
  platform_media_id: string | null;
  error_message: string | null;
  created_at: string;
}

const MAX_CAPTION_LENGTH = 2200;

export function SocialQueue({
  actionable,
  recent,
}: {
  actionable: SocialPost[];
  recent: SocialPost[];
}) {
  const failed = actionable.filter((p) => p.status === "failed");
  const queued = actionable.filter((p) => p.status === "queued");

  return (
    <section>
      <div className="mb-3.5 flex items-baseline justify-between">
        <h2 className="t-h2 text-emerald-950">
          Review Queue
        </h2>
        <span className="t-caption font-semibold text-emerald-900/40">
          {actionable.length} post{actionable.length !== 1 && "s"} · Instagram
        </span>
      </div>

      {actionable.length === 0 ? (
        <div className="rounded-2xl border border-emerald-900/10 bg-white p-12 text-center shadow-sm">
          <p className="text-4xl">{"\u{1F4F1}"}</p>
          <p className="t-h3 mt-3 text-emerald-900/40">
            Queue empty
          </p>
          <p className="t-body mt-1 text-emerald-900/35">
            Posts appear here after the Monday digest runs.
          </p>
        </div>
      ) : (
        <>
          {failed.length > 0 && (
            <>
              <BandLabel level="critical" label="Fix first — failed" count={failed.length} />
              <div className="space-y-3">
                {failed.map((post) => (
                  <QueueCard key={post.id} post={post} />
                ))}
              </div>
            </>
          )}

          {queued.length > 0 && (
            <>
              <BandLabel level="attention" label="Awaiting review" count={queued.length} />
              <div className="space-y-3">
                {queued.map((post) => (
                  <QueueCard key={post.id} post={post} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {recent.length > 0 && <HistoryAccordion posts={recent} />}
    </section>
  );
}

/* ---------------------------------------------------------------- band ---- */

function BandLabel({
  level,
  label,
  count,
}: {
  level: "critical" | "attention";
  label: string;
  count: number;
}) {
  const text = level === "critical" ? "text-red-700" : "text-amber-600";
  const dot = level === "critical" ? "bg-red-500" : "bg-amber-500";
  const ct = level === "critical" ? "bg-red-600" : "bg-amber-500";
  return (
    <div className="mb-2.5 mt-5 flex items-center gap-2 first:mt-0">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      <h3 className={`t-label font-extrabold ${text}`}>
        {label}
      </h3>
      <span
        className={`t-caption rounded-full px-2 py-px font-bold text-white ${ct}`}
      >
        {count}
      </span>
      <span className="ml-1 hidden h-px flex-1 bg-emerald-900/10 lg:block" />
    </div>
  );
}

/* ----------------------------------------------------------- queue card ---- */

const CHIP: Record<string, string> = {
  failed: "bg-red-50 text-red-700",
  queued: "bg-amber-50 text-amber-700",
};
const CHIP_DOT: Record<string, string> = {
  failed: "bg-red-500",
  queued: "bg-amber-500",
};

function QueueCard({ post }: { post: SocialPost }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState(post.caption);

  const isFailed = post.status === "failed";

  const publish = useOptimisticAction(() => publishPost(post.id), {
    successMessage: "Published to Instagram",
    onSuccess: () => router.refresh(),
  });
  const retry = useOptimisticAction(() => retryPost(post.id), {
    successMessage: "Re-queued for publishing",
    onSuccess: () => router.refresh(),
  });
  const reject = useOptimisticAction(() => rejectPost(post.id), {
    successMessage: "Post rejected",
    onSuccess: () => router.refresh(),
  });
  const save = useOptimisticAction(() => updatePostCaption(post.id, caption), {
    successMessage: "Caption saved",
    onSuccess: () => router.refresh(),
  });

  const pending =
    publish.pending || retry.pending || reject.pending || save.pending;
  const error =
    publish.error || retry.error || reject.error || save.error;

  const stripe = isFailed ? "bg-red-500" : "bg-amber-500";
  const surface = isFailed
    ? "border-red-200 bg-gradient-to-t from-red-50 to-white"
    : "border-emerald-900/10 bg-white";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border pl-[18px] shadow-sm transition hover:shadow-md ${surface}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 ${stripe}`}
        aria-hidden="true"
      />
      <div className="p-4">
        {/* top row: thumb + meta + caption */}
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image_url}
            alt=""
            className="h-16 w-16 flex-none rounded-[10px] border border-emerald-900/10 object-cover lg:h-[74px] lg:w-[74px]"
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`t-caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold capitalize ${CHIP[post.status] ?? CHIP.queued}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${CHIP_DOT[post.status] ?? CHIP_DOT.queued}`}
                  aria-hidden="true"
                />
                {post.status}
              </span>
              <span className="t-caption rounded-full border border-emerald-900/10 bg-emerald-900/[0.04] px-2 py-0.5 font-semibold text-emerald-900/55">
                {post.post_type}
              </span>
              <AgeBadge timestamp={post.created_at} prefix="waiting" />
            </div>
            <p className="t-small line-clamp-2 leading-relaxed text-emerald-900/70 lg:line-clamp-2">
              {post.caption}
            </p>
          </div>
        </div>

        {/* error message */}
        {post.error_message && (
          <div className="t-caption mt-3 break-words rounded-lg border border-red-200 bg-red-50 px-3 py-2 leading-snug text-red-700">
            {post.error_message}
          </div>
        )}

        {/* inline editor */}
        {open && (
          <div className="mt-3.5 border-t border-emerald-900/10 pt-3.5">
            <div className="flex flex-col gap-3 lg:flex-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.image_url}
                alt="Post preview"
                className="w-full self-start rounded-xl border border-emerald-900/10 object-cover lg:w-[230px]"
              />
              <div className="flex flex-1 flex-col">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={6}
                  maxLength={MAX_CAPTION_LENGTH}
                  className="min-h-[128px] w-full resize-y rounded-xl border border-emerald-900/15 p-3 text-[13px] leading-relaxed text-emerald-900/80 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span
                    className={`t-caption font-semibold ${caption.length > MAX_CAPTION_LENGTH ? "text-red-500" : "text-emerald-900/40"}`}
                  >
                    {caption.length} / {MAX_CAPTION_LENGTH}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={save.run}
                      disabled={pending || caption === post.caption}
                      className="t-caption rounded-full border border-emerald-900/15 bg-white px-4 py-2 font-bold text-emerald-900 transition hover:border-emerald-300 disabled:opacity-30"
                    >
                      Save caption
                    </button>
                    <button
                      type="button"
                      onClick={publish.run}
                      disabled={pending}
                      className="t-caption rounded-full bg-emerald-600 px-4 py-2 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {publish.pending ? "Publishing…" : "Publish to Instagram"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* actions */}
        <div className="mt-3 flex items-center gap-2">
          {isFailed ? (
            <button
              type="button"
              onClick={retry.run}
              disabled={pending}
              className="t-body flex-1 rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 lg:flex-none"
            >
              {retry.pending ? "Retrying…" : "Retry"}
            </button>
          ) : (
            <button
              type="button"
              onClick={publish.run}
              disabled={pending}
              className="t-body flex-1 rounded-full bg-emerald-600 px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 lg:flex-none"
            >
              {publish.pending ? "Publishing…" : "Publish"}
            </button>
          )}
          <button
            type="button"
            onClick={reject.run}
            disabled={pending}
            className="t-body flex-1 rounded-full border border-emerald-900/15 bg-white px-4 py-2.5 font-bold text-emerald-900 transition hover:border-red-200 hover:text-red-600 disabled:opacity-50 lg:flex-none"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="t-caption rounded-full px-3 py-2.5 font-semibold text-emerald-900/45 transition hover:text-emerald-900"
          >
            {open ? "Collapse" : "Edit"}
          </button>
        </div>

        {error && <p className="t-caption mt-2 text-red-500">{error}</p>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- history accordion */

const HCHIP: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700",
  rejected: "bg-emerald-900/[0.06] text-emerald-900/45",
};
const HCHIP_DOT: Record<string, string> = {
  published: "bg-emerald-500",
  rejected: "bg-emerald-900/30",
};

function HistoryAccordion({ posts }: { posts: SocialPost[] }) {
  return (
    <details className="group mt-4 rounded-2xl border border-emerald-900/10 bg-white p-4">
      <summary className="t-body flex cursor-pointer list-none items-center gap-2 font-bold text-emerald-900/70 [&::-webkit-details-marker]:hidden">
        <span className="text-emerald-900/40 transition group-open:rotate-90">
          {"▸"}
        </span>
        Recent history — {posts.length} published / rejected
      </summary>
      <div className="mt-2">
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex items-center gap-3 border-b border-emerald-900/[0.07] py-3 last:border-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.image_url}
              alt=""
              className="h-9 w-9 flex-none rounded-lg object-cover"
            />
            <span
              className={`t-caption inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold capitalize ${HCHIP[post.status] ?? HCHIP.rejected}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${HCHIP_DOT[post.status] ?? HCHIP_DOT.rejected}`}
                aria-hidden="true"
              />
              {post.status}
            </span>
            <span className="t-small min-w-0 flex-1 truncate text-emerald-900/70">
              {post.caption}
            </span>
            <span className="t-caption flex-none font-semibold text-emerald-900/40">
              <AgeBadgePlain timestamp={post.published_at ?? post.created_at} />
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

/** Bare relative-time used inside history rows (no pill chrome). */
function AgeBadgePlain({ timestamp }: { timestamp: string }) {
  const label = useMemo(() => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }, [timestamp]);
  return <>{label}</>;
}
