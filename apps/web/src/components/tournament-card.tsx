import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { FieldStrengthBadge } from "./field-strength-badge";

export function TournamentCard({
  tournament: t,
  citySlug,
}: {
  tournament: Tournament;
  citySlug?: string;
}) {
  const slug = citySlug ?? "";
  const href = slug ? `/${slug}/tournaments/${t.id}` : `/tournaments/${t.id}`;
  const hasIntel = (t.total_live_dupr ?? 0) > 0;
  const showSandbagger = t.max_sandbagger_pct != null && t.max_sandbagger_pct > 0.2;

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 transition-all duration-200 hover:shadow-md hover:ring-emerald-200"
    >
      {/* Main card body */}
      <div className="p-4">
        {/* Top row: left info + right entry fee */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Date + event count */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-emerald-600">
                {formatDateRange(t.date_start, t.date_end)}
              </span>
              {t.event_count != null && t.event_count > 0 && (
                <span className="text-xs text-emerald-600 opacity-70">
                  · {t.event_count} event{t.event_count !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {/* Tournament name */}
            <h3 className="font-bold text-gray-900 leading-snug truncate group-hover:text-emerald-700">
              {t.name}
            </h3>
            {/* Venue */}
            <p className="mt-0.5 text-sm text-gray-400 truncate">{t.location_name}</p>
          </div>

          {/* Entry fee */}
          {t.entry_fee != null && (
            <div className="shrink-0 text-right">
              <span className="text-lg font-bold text-emerald-600">
                {formatCurrency(t.entry_fee)}
              </span>
            </div>
          )}
        </div>

        {/* Badge row */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {/* Registered count */}
          {t.total_registered != null && t.total_registered > 0 && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              {t.total_registered} registered
            </span>
          )}

          {/* Sandbagger alert */}
          {showSandbagger && (
            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-200">
              Sandbagger Alert
            </span>
          )}

          {/* Field strength badge */}
          <FieldStrengthBadge
            avgFieldStrength={t.avg_field_strength}
            maxSandbaggerPct={t.max_sandbagger_pct}
            size="sm"
          />
        </div>
      </div>

      {/* Intel footer — only shown when tournament has intelligence data */}
      {hasIntel && (
        <div className="flex items-center justify-between bg-[#065f46] px-4 py-2">
          <div className="flex items-center gap-2">
            {/* Pulsing green dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-medium text-white">
              {t.total_live_dupr} live DUPR rating{(t.total_live_dupr ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-xs text-white opacity-60">View intel →</span>
        </div>
      )}
    </Link>
  );
}
