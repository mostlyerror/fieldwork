import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { SkillBadge } from "./skill-badge";
import { StatusBadge } from "./status-badge";
import { FieldStrengthBadge } from "./field-strength-badge";

function isToday(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function TournamentCard({ tournament, citySlug }: { tournament: Tournament; citySlug?: string }) {
  const { id, name, date_start, date_end, location_name, location_address, skill_levels, entry_fee, registration_status, created_at } = tournament;
  const justAdded = isToday(created_at);

  return (
    <Link
      href={citySlug ? `/${citySlug}/tournaments/${id}` : `/tournaments/${id}`}
      className="group block rounded-2xl bg-gradient-to-br from-white to-amber-50/20 p-5 shadow-sm ring-1 ring-orange-100/60 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-orange-100/40 hover:ring-emerald-200"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-gradient-to-r from-orange-100 to-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
              {formatDateRange(date_start, date_end)}
            </span>
            {justAdded && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                Just added
              </span>
            )}
          </div>
          <h3 className="font-extrabold leading-snug text-gray-900 group-hover:text-emerald-600">{name}</h3>
        </div>
        <StatusBadge status={registration_status} />
      </div>

      <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
        <span>{"\u{1F4CD}"}</span> {location_name}
      </p>
      {location_address && (
        <p className="text-xs text-gray-400">{location_address}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-1">
          {skill_levels?.map((level) => (
            <SkillBadge key={level} level={level} />
          ))}
          <FieldStrengthBadge
            avgFieldStrength={tournament.avg_field_strength}
            maxSandbaggerPct={tournament.max_sandbagger_pct}
          />
        </div>
        {entry_fee != null && (
          <span className="text-sm font-bold text-emerald-600">
            {formatCurrency(entry_fee)}
          </span>
        )}
      </div>

      {tournament.total_registered != null && tournament.total_registered > 0 && (
        <p className="mt-2 text-[11px] text-gray-400">
          {tournament.total_registered} registered
          {tournament.event_count != null && tournament.event_count > 0 && (
            <> across {tournament.event_count} events</>
          )}
        </p>
      )}
    </Link>
  );
}
