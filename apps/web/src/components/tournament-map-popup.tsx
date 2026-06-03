"use client";

import Link from "next/link";
import { Popup } from "react-map-gl/maplibre";
import type { Tournament } from "@/lib/types";
import { formatDateRange } from "@/lib/format";
import { StatusBadge } from "./status-badge";

export function TournamentMapPopup({
  tournament,
  onClose,
  citySlug,
}: {
  tournament: Tournament;
  onClose: () => void;
  citySlug?: string;
}) {
  return (
    <Popup
      longitude={tournament.longitude!}
      latitude={tournament.latitude!}
      anchor="bottom"
      onClose={onClose}
      closeButton
      closeOnClick={false}
      offset={30}
    >
      <div className="max-w-[240px] p-1">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="t-body font-semibold">
            {tournament.name}
          </h3>
          <StatusBadge status={tournament.registration_status} />
        </div>
        <p className="t-caption text-gray-600">
          {formatDateRange(tournament.date_start, tournament.date_end)}
        </p>
        <p className="mt-0.5 t-caption text-gray-500">
          {tournament.location_name}
        </p>
        <Link
          href={citySlug ? `/${citySlug}/tournaments/${tournament.id}` : `/tournaments/${tournament.id}`}
          className="mt-2 inline-block t-caption text-green-600 hover:text-green-700"
        >
          View details →
        </Link>
      </div>
    </Popup>
  );
}
