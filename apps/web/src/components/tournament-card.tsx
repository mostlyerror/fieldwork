import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { SkillBadge } from "./skill-badge";
import { StatusBadge } from "./status-badge";

function isToday(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const { id, name, date_start, date_end, location_name, location_address, skill_levels, entry_fee, registration_status, created_at } = tournament;
  const justAdded = isToday(created_at);

  return (
    <Link
      href={`/tournaments/${id}`}
      className="group block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-green-200"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {formatDateRange(date_start, date_end)}
            </span>
            {justAdded && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                Just added
              </span>
            )}
          </div>
          <h3 className="font-bold leading-snug text-gray-900 group-hover:text-green-700">{name}</h3>
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
        <div className="flex flex-wrap gap-1">
          {skill_levels?.map((level) => (
            <SkillBadge key={level} level={level} />
          ))}
        </div>
        {entry_fee != null && (
          <span className="text-sm font-bold text-green-600">
            {formatCurrency(entry_fee)}
          </span>
        )}
      </div>
    </Link>
  );
}
