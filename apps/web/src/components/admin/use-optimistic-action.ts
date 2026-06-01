"use client";

/**
 * useOptimisticAction — run a server action with optimistic UI, a success toast,
 * and a scoped inline error (no full-page reload) when it fails.
 *
 * Designed for the admin per-source / per-row buttons ("Re-run this source",
 * "Approve", "Reject"): the button flips to a pending state immediately, the
 * result surfaces as a toast on success, and on failure the error is kept
 * local to the call site so nothing else on the page reloads or resets.
 *
 * The action should resolve normally on success and either throw or return
 * `{ ok: false, error }` on failure — both are handled.
 */

import { useCallback, useRef, useState, useTransition } from "react";
import { useToast } from "./toast";

/** Allowed action results. Throw, or return one of these shapes. */
export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string }
  | void
  | T;

function isFailure(
  result: unknown
): result is { ok: false; error: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "ok" in result &&
    (result as { ok: unknown }).ok === false
  );
}

export interface UseOptimisticActionOptions {
  /** Toast shown on success. Omit to stay silent. */
  successMessage?: string;
  /** Fallback error message when the action throws without one. */
  errorMessage?: string;
  /** Called after a successful run (e.g. router.refresh()). */
  onSuccess?: () => void;
  /** Called after a failed run, with the resolved message. */
  onError?: (message: string) => void;
}

export interface UseOptimisticActionReturn {
  /** Fire the action. Safe to wire straight to onClick. */
  run: () => void;
  /** True while the action (and any transition) is in flight. */
  pending: boolean;
  /** Scoped error message from the last failed run, or null. */
  error: string | null;
  /** Clear the inline error (e.g. on retry or dismiss). */
  clearError: () => void;
}

export function useOptimisticAction(
  action: () => Promise<ActionResult>,
  options: UseOptimisticActionOptions = {}
): UseOptimisticActionReturn {
  const {
    successMessage,
    errorMessage = "Something went wrong. Try again.",
    onSuccess,
    onError,
  } = options;

  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep latest callbacks/action without re-creating `run` on every render.
  const ref = useRef({ action, successMessage, errorMessage, onSuccess, onError, toast });
  ref.current = { action, successMessage, errorMessage, onSuccess, onError, toast };

  const clearError = useCallback(() => setError(null), []);

  const run = useCallback(() => {
    const {
      action: act,
      successMessage: success,
      errorMessage: fallback,
      onSuccess: success_cb,
      onError: error_cb,
      toast: push,
    } = ref.current;

    setError(null);
    setRunning(true);
    startTransition(async () => {
      try {
        const result = await act();
        if (isFailure(result)) {
          setError(result.error);
          push(result.error, "error");
          error_cb?.(result.error);
          return;
        }
        if (success) push(success, "success");
        success_cb?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : fallback;
        setError(message);
        push(message, "error");
        error_cb?.(message);
      } finally {
        setRunning(false);
      }
    });
  }, []);

  return { run, pending: running || isPending, error, clearError };
}
