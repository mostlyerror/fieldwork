"use client";

/**
 * Minimal admin toast system — no external deps.
 *
 * Wrap the admin shell once in <ToastProvider>, then call useToast() anywhere
 * to push a transient success/error/info message. Used by useOptimisticAction
 * to surface the result of a server action without a full page reload.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  /** Push a toast; returns its id. */
  toast: (message: string, tone?: ToastTone) => number;
  /** Dismiss a toast early by id. */
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-emerald-900/10 bg-white text-emerald-900",
};

const TONE_DOT: Record<ToastTone, string> = {
  success: "bg-emerald-500",
  error: "bg-red-500",
  info: "bg-emerald-900/40",
};

let nextId = 1;

export function ToastProvider({
  children,
  duration = 4000,
}: {
  children: React.ReactNode;
  /** Auto-dismiss delay in ms. */
  duration?: number;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, tone, message }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss, duration]
  );

  // Clear any pending timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-semibold shadow-lg shadow-emerald-900/5 ${TONE_STYLES[t.tone]}`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 flex-none rounded-full ${TONE_DOT[t.tone]}`}
            />
            <span className="flex-1">{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Access the toast API. Throws if no <ToastProvider> is mounted above —
 * the admin shell mounts one, so any admin client component can use it.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
