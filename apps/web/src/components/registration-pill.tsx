import type { Tournament } from "@/lib/types";
import { getRegistrationStatus, formatUrgency, urgencyTier } from "@/lib/registration";

export function RegistrationPill({ tournament }: { tournament: Tournament }) {
  const status = getRegistrationStatus(tournament);
  const tier = urgencyTier(status.msUntil, status.isClosed);

  if (tier === "normal") return null;

  if (tier === "closed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-500">
        Registration closed
      </span>
    );
  }

  const text = formatUrgency(status.msUntil) ?? "";
  if (tier === "urgent") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-600">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        {text}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
      {text}
    </span>
  );
}
