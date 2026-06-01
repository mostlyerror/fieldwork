"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Tournament, TournamentSource } from "@/lib/types";
import { formatDateRange, formatCurrency, relativeDate, googleMapsUrl } from "@/lib/format";
import { googleCalendarUrl } from "@/lib/calendar";
import { SOURCE_DISPLAY_NAMES } from "@/lib/constants";
import { ShareButtons } from "./share-buttons";
import { RegistrationPill } from "./registration-pill";
import { getRegistrationStatus } from "@/lib/registration";
import { track } from "@/lib/analytics";
import { isPublicStatus } from "@/lib/tournament-status";

export function TournamentDetail({
  tournament,
  sources,
  citySlug,
}: {
  tournament: Tournament;
  sources: TournamentSource[];
  citySlug?: string;
}) {
  const withUrl = sources.filter((s) => s.registration_url);
  const relative = relativeDate(tournament.date_start);
  const mapsUrl = googleMapsUrl({
    latitude: tournament.latitude,
    longitude: tournament.longitude,
    address: tournament.location_address,
    name: tournament.location_name,
  });

  const [stickyVisible, setStickyVisible] = useState(false);
  useEffect(() => {
    function onScroll() {
      setStickyVisible(window.scrollY > 300);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const primarySource = withUrl[0];
  const regStatus = getRegistrationStatus(tournament);

  useEffect(() => {
    track("tournament_viewed", {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      registrationClosed: regStatus.isClosed,
      eventCount: tournament.event_count,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament.id]);

  function logRegister(source: string) {
    track("register_button_clicked", {
      tournamentId: tournament.id,
      sourcePlatform: source,
      registrationClosed: regStatus.isClosed,
    });
  }

  // Build stats prose
  const statParts: React.ReactNode[] = [];
  if (tournament.entry_fee != null) {
    statParts.push(
      <span key="fee">
        <span className="font-extrabold text-emerald-800">{formatCurrency(tournament.entry_fee)}</span> entry
      </span>
    );
  }
  if ((tournament.total_registered ?? 0) > 0) {
    statParts.push(
      <span key="reg">
        <span className="font-extrabold text-gray-900">{tournament.total_registered}</span> registered
        {(tournament.event_count ?? 0) > 0 && (
          <> across <span className="font-extrabold text-gray-900">{tournament.event_count}</span> events</>
        )}
      </span>
    );
  } else if ((tournament.event_count ?? 0) > 0) {
    statParts.push(
      <span key="events">
        <span className="font-extrabold text-gray-900">{tournament.event_count}</span> events
      </span>
    );
  }

  return (
    <>
      {!isPublicStatus(tournament.status) && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
          <p className="text-sm font-bold text-amber-900">
            DRAFT — not public yet
          </p>
          <p className="mt-1 text-sm text-amber-800">
            This page is private and excluded from search and listings. Share the
            link with the organizer; publish from the admin Flyer Import tool once
            they confirm.
          </p>
        </div>
      )}

      {/* Sticky action bar */}
      <div
        aria-hidden={!stickyVisible}
        className={`fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm transform transition-transform duration-200 ${
          stickyVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-gray-900 truncate min-w-0 max-w-[60%] sm:max-w-none">
            {tournament.name}
          </span>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {primarySource && (
              regStatus.isClosed ? (
                <a
                  href={primarySource.registration_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logRegister(primarySource.source_platform)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-200 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold text-gray-600 transition hover:bg-gray-300 whitespace-nowrap"
                >
                  <span className="sm:hidden">View ↗</span>
                  <span className="hidden sm:inline">View on {SOURCE_DISPLAY_NAMES[primarySource.source_platform] ?? "source"} ↗</span>
                </a>
              ) : (
                <a
                  href={primarySource.registration_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logRegister(primarySource.source_platform)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold text-white transition hover:bg-emerald-800 whitespace-nowrap"
                >
                  Register ↗
                </a>
              )
            )}
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex text-gray-400 hover:text-emerald-700" title="Map">
              📍
            </a>
            <a href={googleCalendarUrl(tournament)} target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex text-gray-400 hover:text-emerald-700" title="Add to Calendar">
              📅
            </a>
            <ShareButtons
              tournamentId={tournament.id}
              tournamentName={tournament.name}
              dateRange={formatDateRange(tournament.date_start, tournament.date_end)}
              venue={tournament.venue_name || tournament.location_name}
              registered={tournament.total_registered ?? undefined}
              eventCount={tournament.event_count ?? undefined}
              liveRatings={tournament.total_live_dupr ?? undefined}
            />
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="py-10 sm:py-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 leading-tight break-words">
          {tournament.name}
        </h1>

        {/* Date · Venue · Relative */}
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xl text-gray-500 font-medium">
            {formatDateRange(tournament.date_start, tournament.date_end)}
          </span>
          <span className="text-gray-300 text-xl">·</span>
          {tournament.venue_slug && citySlug ? (
            <Link
              href={`/${citySlug}/venues/${tournament.venue_slug}`}
              className="text-xl font-medium text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-2 hover:decoration-emerald-600"
            >
              {tournament.venue_name || tournament.location_name}
            </Link>
          ) : (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xl font-medium text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-2 hover:decoration-emerald-600"
            >
              {tournament.location_name}
            </a>
          )}
          {relative && (
            <>
              <span className="text-gray-300 text-xl">·</span>
              <span className="text-xl text-emerald-700 font-semibold">{relative}</span>
            </>
          )}
        </div>

        {/* Stats as inline prose */}
        {statParts.length > 0 && (
          <p className="mt-5 text-lg text-gray-500 font-medium">
            {statParts.map((part, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-2 text-gray-300">·</span>}
                {part}
              </span>
            ))}
          </p>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-4 sm:gap-x-6 sm:gap-y-3">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-x-6 sm:gap-y-3">
            {withUrl.map((source) => (
              regStatus.isClosed ? (
                <a
                  key={source.id}
                  href={source.registration_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logRegister(source.source_platform)}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gray-200 px-5 py-3 text-base font-bold text-gray-600 transition hover:bg-gray-300"
                >
                  <span className="sm:hidden">View ↗</span>
                  <span className="hidden sm:inline">View on {SOURCE_DISPLAY_NAMES[source.source_platform] ?? source.source_platform} ↗</span>
                </a>
              ) : (
                <a
                  key={source.id}
                  href={source.registration_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logRegister(source.source_platform)}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-base font-bold text-white transition hover:bg-emerald-800"
                >
                  <span className="sm:hidden">Register ↗</span>
                  <span className="hidden sm:inline">Register on {SOURCE_DISPLAY_NAMES[source.source_platform] ?? source.source_platform} ↗</span>
                </a>
              )
            ))}
            <RegistrationPill tournament={tournament} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 hover:underline">
              Map
            </a>
            <span>·</span>
            <a href={googleCalendarUrl(tournament)} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 hover:underline">
              Add to Cal
            </a>
            <span>·</span>
            <ShareButtons
              tournamentId={tournament.id}
              tournamentName={tournament.name}
              dateRange={formatDateRange(tournament.date_start, tournament.date_end)}
              venue={tournament.venue_name || tournament.location_name}
              registered={tournament.total_registered ?? undefined}
              eventCount={tournament.event_count ?? undefined}
              liveRatings={tournament.total_live_dupr ?? undefined}
            />
          </div>
        </div>
      </div>
    </>
  );
}
