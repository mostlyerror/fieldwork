"use client";

/**
 * <AgeBadge> — relative age ("3h ago") that escalates color as it gets stale.
 *
 * healthy (emerald) → attention (amber, past `staleMs`) → critical (red, past
 * `criticalMs`). Used on source cards (last successful run) and queue rows
 * (how long a submission has waited). Presentational; no data fetching.
 *
 * Renders on a client clock so the age stays live without a reload. Guards
 * against hydration mismatch by deferring the relative string to after mount.
 */

import { useEffect, useState } from "react";
import { ADMIN_STATUS, type AdminStatus } from "@/lib/admin-status";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Default escalation thresholds: stale after 3h, critical after 24h. */
const DEFAULT_STALE_MS = 3 * HOUR;
const DEFAULT_CRITICAL_MS = 24 * HOUR;

function formatAge(ms: number): string {
  if (ms < MINUTE) return "just now";
  const mins = Math.floor(ms / MINUTE);
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

function statusFor(
  ms: number,
  staleMs: number,
  criticalMs: number
): AdminStatus {
  if (ms >= criticalMs) return "critical";
  if (ms >= staleMs) return "attention";
  return "healthy";
}

export function AgeBadge({
  timestamp,
  staleMs = DEFAULT_STALE_MS,
  criticalMs = DEFAULT_CRITICAL_MS,
  prefix,
  className = "",
}: {
  /** When the thing happened — Date, ISO string, or epoch ms. */
  timestamp: Date | string | number;
  /** Past this age, escalate to amber. Default 3h. */
  staleMs?: number;
  /** Past this age, escalate to red. Default 24h. */
  criticalMs?: number;
  /** Optional label before the age, e.g. "waiting". */
  prefix?: string;
  className?: string;
}) {
  const at =
    timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();

  // Tick every minute so the badge stays current. Start null to keep SSR
  // and first client render identical (avoids hydration mismatch).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(id);
  }, []);

  const age = now === null ? 0 : Math.max(0, now - at);
  const status = now === null ? "healthy" : statusFor(age, staleMs, criticalMs);
  const tokens = ADMIN_STATUS[status];
  const text = now === null ? "…" : formatAge(age);

  return (
    <span
      title={new Date(at).toLocaleString()}
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em] ${tokens.bg} ${tokens.text} ${className}`}
    >
      {prefix ? `${prefix} ` : ""}
      {text}
    </span>
  );
}
