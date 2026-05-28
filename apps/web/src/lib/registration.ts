import type { Tournament } from "./types";

export interface RegistrationStatus {
  isClosed: boolean;
  /** Deadline used for urgency. Falls back to tournament start date if no explicit close date. */
  deadline: Date;
  /** Whether the deadline came from an explicit close date (vs falling back to start date). */
  hasExplicitClose: boolean;
  /** Milliseconds until deadline (negative if past). */
  msUntil: number;
}

export function getRegistrationStatus(t: Tournament, now: Date = new Date()): RegistrationStatus {
  const hasExplicitClose = t.registration_close_date != null;
  const deadlineStr = t.registration_close_date ?? `${t.date_start}T00:00:00`;
  const deadline = new Date(deadlineStr);
  const msUntil = deadline.getTime() - now.getTime();
  return {
    isClosed: msUntil < 0 || t.registration_status === "closed",
    deadline,
    hasExplicitClose,
    msUntil,
  };
}

export function formatUrgency(msUntil: number): string | null {
  if (msUntil < 0) return null;
  const hours = msUntil / (1000 * 60 * 60);
  if (hours < 1) {
    const mins = Math.max(1, Math.round(msUntil / (1000 * 60)));
    return `Closes in ${mins} min`;
  }
  if (hours < 24) {
    return `Closes in ${Math.round(hours)}h`;
  }
  const days = Math.ceil(hours / 24);
  return `Closes in ${days} day${days === 1 ? "" : "s"}`;
}

export type UrgencyTier = "closed" | "urgent" | "soon" | "normal";

export function urgencyTier(msUntil: number, isClosed: boolean): UrgencyTier {
  if (isClosed) return "closed";
  const hours = msUntil / (1000 * 60 * 60);
  if (hours < 24) return "urgent";
  if (hours < 24 * 7) return "soon";
  return "normal";
}
