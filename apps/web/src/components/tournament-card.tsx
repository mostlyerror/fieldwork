import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency } from "@/lib/format";
import { SkillBadge } from "./skill-badge";
import { StatusBadge } from "./status-badge";

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const { id, name, date_start, date_end, location_name, location_address, skill_levels, entry_fee, registration_status } = tournament;

  return (
    <Link
      href={`/tournaments/${id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-green-300 hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug text-gray-900">{name}</h3>
        <StatusBadge status={registration_status} />
      </div>

      <p className="text-sm text-gray-600">
        {formatDateRange(date_start, date_end)}
      </p>

      <p className="mt-1 text-sm text-gray-500">{location_name}</p>
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
          <span className="text-sm font-medium text-gray-700">
            {formatCurrency(entry_fee)}
          </span>
        )}
      </div>
    </Link>
  );
}
