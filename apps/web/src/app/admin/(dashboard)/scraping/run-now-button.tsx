"use client";

/**
 * Scoped "Run now" button for the scraping cockpit.
 *
 * Wraps the runSource server action in useOptimisticAction so the click flips to
 * a pending state immediately, surfaces success/failure as a toast, and refreshes
 * the page data on success — no full reload. Used both in the AttentionBanner
 * action slot and inside each source card.
 */

import { useRouter } from "next/navigation";
import { useOptimisticAction } from "@/components/admin/use-optimistic-action";
import { runSource } from "./actions";

type Variant = "primary" | "alarm" | "calm";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:hover:bg-emerald-600",
  alarm:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:hover:bg-red-600",
  calm: "border border-emerald-900/15 bg-white text-emerald-900 hover:border-emerald-900/30",
};

export function RunNowButton({
  source,
  label = "Run now",
  variant = "primary",
  size = "md",
  className = "",
}: {
  /** Source label for attribution + toast copy. Omit to run all sources. */
  source?: string;
  label?: string;
  variant?: Variant;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const { run, pending } = useOptimisticAction(() => runSource(source), {
    successMessage: source
      ? `Dispatched a run for ${source}. Watch the workflow log for progress.`
      : "Dispatched a full scrape run. Watch the workflow log for progress.",
    errorMessage: "Couldn't dispatch the run. Check the GitHub token and retry.",
    onSuccess: () => router.refresh(),
  });

  const pad = size === "sm" ? "px-3 py-1.5 t-caption" : "px-4 py-2 t-body";

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-full font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${pad} ${VARIANTS[variant]} ${className}`}
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current"
        />
      ) : (
        <span aria-hidden="true">{"↻"}</span>
      )}
      {pending ? "Dispatching…" : label}
    </button>
  );
}
