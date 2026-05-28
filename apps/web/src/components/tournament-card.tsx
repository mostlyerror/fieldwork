import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { FieldStrengthBadge } from "./field-strength-badge";
import { RegistrationPill } from "./registration-pill";

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
      className="flex flex-col overflow-hidden rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition"
    >
      {/* Main card body */}
      <div className="flex-1 p-5">
        {/* Row 1: date + event count (left) + price (right) */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-emerald-800">
              {formatDateRange(t.date_start, t.date_end)}
            </span>
            {t.event_count != null && t.event_count > 0 && (
              <span className="text-sm font-semibold text-emerald-800">
                · {t.event_count} event{t.event_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {t.entry_fee != null && (
            <span className="shrink-0 text-2xl font-extrabold text-emerald-800">
              {formatCurrency(t.entry_fee)}
            </span>
          )}
        </div>

        {/* Row 2: tournament name */}
        <h3
          className="mt-1 text-xl font-extrabold text-gray-900 tracking-tight leading-snug"
          style={{ letterSpacing: "-0.3px" }}
        >
          {t.name}
        </h3>

        {/* Row 3: venue */}
        <p className="text-sm text-gray-500 truncate">{t.location_name}</p>

        {/* Row 4: badge pills */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {t.total_registered != null && t.total_registered > 0 && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              {t.total_registered} registered
            </span>
          )}

          {showSandbagger && (
            <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">
              Sandbagger Alert
            </span>
          )}

          <FieldStrengthBadge
            avgFieldStrength={t.avg_field_strength}
            maxSandbaggerPct={t.max_sandbagger_pct}
            size="sm"
          />

          <RegistrationPill tournament={t} />
        </div>
      </div>

      {/* Intel footer — only when tournament has live DUPR data */}
      {hasIntel && (
        <div className="flex items-center justify-between bg-[#065f46] px-5 py-2.5">
          <div className="flex items-center gap-2">
            {/* Pulsing green dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-sm font-semibold text-white">
              {t.total_live_dupr} live DUPR rating{(t.total_live_dupr ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-sm font-semibold text-white opacity-60">View intel →</span>
        </div>
      )}
    </Link>
  );
}
