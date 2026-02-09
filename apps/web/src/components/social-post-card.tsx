"use client";

import { useState, useTransition } from "react";
import {
  updatePostCaption,
  publishPost,
  rejectPost,
  retryPost,
} from "@/app/admin/(dashboard)/social/actions";

interface SocialPost {
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

const STATUS_STYLES: Record<string, string> = {
  published: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  rejected: "bg-gray-100 text-gray-500",
  queued: "bg-amber-50 text-amber-700",
};

export function SocialPostCard({ post }: { post: SocialPost }) {
  const [caption, setCaption] = useState(post.caption);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isQueued = post.status === "queued";
  const isFailed = post.status === "failed";
  const isPublished = post.status === "published";

  function handleAction(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        window.location.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition duration-200 hover:shadow-md hover:ring-green-200">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-500">
            {post.platform}
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-500">
            {post.post_type}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(post.created_at).toLocaleString()}
          </span>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[post.status] ?? STATUS_STYLES.queued}`}
        >
          {post.status}
        </span>
      </div>

      {/* Image preview */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={post.image_url}
        alt="Post preview"
        className="mb-4 w-full rounded-xl border border-gray-100 object-cover"
        style={{ maxHeight: 315 }}
      />

      {/* Editable caption */}
      {isQueued || isFailed ? (
        <div className="mb-4">
          <textarea
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value);
              setSaved(false);
            }}
            rows={8}
            maxLength={MAX_CAPTION_LENGTH}
            className="w-full rounded-2xl border border-gray-200 p-3 text-sm leading-relaxed text-gray-700 shadow-sm placeholder-gray-400 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100"
          />
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span
              className={
                caption.length > MAX_CAPTION_LENGTH
                  ? "text-red-500"
                  : "text-gray-400"
              }
            >
              {caption.length}/{MAX_CAPTION_LENGTH}
            </span>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="font-medium text-green-600">Saved</span>
              )}
              <button
                onClick={() =>
                  handleAction(async () => {
                    await updatePostCaption(post.id, caption);
                    setSaved(true);
                  })
                }
                disabled={isPending || caption === post.caption}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-200 transition hover:ring-green-300 disabled:opacity-30"
              >
                Save caption
              </button>
            </div>
          </div>
        </div>
      ) : (
        <pre className="mb-4 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm leading-relaxed text-gray-600">
          {post.caption}
        </pre>
      )}

      {/* Error message */}
      {post.error_message && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-600">
          {post.error_message}
        </div>
      )}

      {/* Published info */}
      {isPublished && post.published_at && (
        <p className="mb-4 text-xs text-gray-400">
          Published {new Date(post.published_at).toLocaleString()}
          {post.platform_media_id &&
            ` \u2014 Media ID: ${post.platform_media_id}`}
        </p>
      )}

      {/* Action buttons */}
      {(isQueued || isFailed) && (
        <div className="flex gap-2 border-t border-gray-100 pt-4">
          <button
            onClick={() => handleAction(() => publishPost(post.id))}
            disabled={isPending}
            className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? "Publishing\u2026" : "Publish"}
          </button>
          {isFailed && (
            <button
              onClick={() => handleAction(() => retryPost(post.id))}
              disabled={isPending}
              className="rounded-full bg-amber-50 px-5 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
            >
              Retry
            </button>
          )}
          <button
            onClick={() => handleAction(() => rejectPost(post.id))}
            disabled={isPending}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-red-600 ring-1 ring-gray-200 transition hover:ring-red-300 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
    </div>
  );
}
