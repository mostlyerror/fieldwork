"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Tournament, TournamentSource } from "@/lib/types";
import {
  formatDateRange,
  formatCurrency,
  relativeDate,
  googleMapsUrl,
  isTournamentPast,
} from "@/lib/format";
import { googleCalendarUrl } from "@/lib/calendar";
import { SOURCE_DISPLAY_NAMES } from "@/lib/constants";
import { ShareButtons } from "./share-buttons";
import { RegistrationPill } from "./registration-pill";
import { getRegistrationStatus } from "@/lib/registration";
import {
  getFieldStrengthLevel,
  type FieldStrengthLevel,
} from "./field-strength-badge";
import { track } from "@/lib/analytics";
import { isPublicStatus } from "@/lib/tournament-status";
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  ArrowRightIcon,
  MedalIcon,
  LockIcon,
  RadarMarkIcon,
} from "./icons";

const FS_TONE: Record<
  FieldStrengthLevel,
  { label: string; text: string; bar: string; box: string; ring: string }
> = {
  friendly: { label: "Friendly field", text: "text-emerald-700", bar: "bg-emerald-600", box: "bg-emerald-50", ring: "ring-emerald-100" },
  competitive: { label: "Competitive", text: "text-amber-700", bar: "bg-amber-500", box: "bg-amber-50", ring: "ring-amber-100" },
  stacked: { label: "Stacked", text: "text-red-700", bar: "bg-red-500", box: "bg-red-50", ring: "ring-red-100" },
  sandbagger: { label: "Sandbagger alert", text: "text-red-700", bar: "bg-red-500", box: "bg-red-50", ring: "ring-red-100" },
};

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
      setStickyVisible(window.scrollY > 280);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const primarySource = withUrl[0];
  const regStatus = getRegistrationStatus(tournament);
  const past = isTournamentPast(tournament);
  const closed = !past && regStatus.isClosed;

  const fsLevel = getFieldStrengthLevel(
    tournament.avg_field_strength,
    tournament.max_sandbagger_pct,
  );
  const fs = fsLevel ? FS_TONE[fsLevel] : null;
  const fsFill = Math.round(
    Math.min(1, Math.max(0.12, tournament.avg_field_strength ?? 0)) * 100,
  );

  const venueName = tournament.venue_name || tournament.location_name;

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

  const stats: { value: string; label: string }[] = [
    {
      value: tournament.entry_fee != null ? formatCurrency(tournament.entry_fee) : "—",
      label: "Entry",
    },
    {
      value: tournament.total_registered ? String(tournament.total_registered) : "—",
      label: "Registered",
    },
    {
      value: tournament.total_live_dupr
        ? String(tournament.total_live_dupr)
        : tournament.event_count
          ? String(tournament.event_count)
          : "—",
      label: tournament.total_live_dupr ? "Live ratings" : "Events",
    },
  ];

  return (
    <>
      {!isPublicStatus(tournament.status) && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
          <p className="text-sm font-bold text-amber-900">DRAFT — not public yet</p>
          <p className="mt-1 text-sm text-amber-800">
            This page is private and excluded from search and listings. Share the
            link with the organizer; publish from the admin Flyer Import tool once
            they confirm.
          </p>
        </div>
      )}

      {/* ── Sticky action bar (on scroll) ── */}
      <div
        aria-hidden={!stickyVisible}
        className={`fixed left-0 right-0 top-0 z-40 transform border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur transition-transform duration-200 ${
          stickyVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
          <span className="min-w-0 max-w-[58%] truncate text-sm font-bold text-gray-900 sm:max-w-none">
            {tournament.name}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {primarySource &&
              (closed || past ? (
                <a
                  href={primarySource.registration_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logRegister(primarySource.source_platform)}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gray-200 px-3.5 py-1.5 text-xs font-bold text-gray-600 transition active:scale-95 sm:text-sm"
                >
                  View <ArrowRightIcon className="h-3.5 w-3.5" />
                </a>
              ) : (
                <a
                  href={primarySource.registration_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logRegister(primarySource.source_platform)}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-800 active:scale-95 sm:text-sm"
                >
                  Register <ArrowRightIcon className="h-3.5 w-3.5" />
                </a>
              ))}
            <ShareButtons
              tournamentId={tournament.id}
              tournamentName={tournament.name}
              dateRange={formatDateRange(tournament.date_start, tournament.date_end)}
              venue={venueName}
              registered={tournament.total_registered ?? undefined}
              eventCount={tournament.event_count ?? undefined}
              liveRatings={tournament.total_live_dupr ?? undefined}
            />
          </div>
        </div>
      </div>

      {/* ── Hero: venue photo or branded fallback (full-bleed on mobile) ── */}
      <div className="relative -mx-3 aspect-[16/10] overflow-hidden bg-emerald-900 sm:-mx-5 sm:aspect-[5/2] sm:rounded-2xl">
        {tournament.venue_photo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={tournament.venue_photo_url}
            alt={venueName}
            className="h-full w-full object-cover"
          />
        ) : (
          <HeroFallback venueName={venueName} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/30" />

        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-3 py-1.5 text-xs font-bold text-gray-900 backdrop-blur sm:left-4 sm:top-4">
          <CalendarIcon className="h-3.5 w-3.5 text-emerald-700" />
          {formatDateRange(tournament.date_start, tournament.date_end)}
        </span>

        {past ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur sm:right-4 sm:top-4">
            <MedalIcon className="h-3.5 w-3.5" /> Final
          </span>
        ) : closed ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur sm:right-4 sm:top-4">
            <LockIcon className="h-3.5 w-3.5" /> Closed
          </span>
        ) : relative ? (
          <span className="absolute right-3 top-3 rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white sm:right-4 sm:top-4">
            {relative}
          </span>
        ) : null}
      </div>

      {/* ── Header content ── */}
      <div className="pt-5 pb-1">
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-[34px]">
          {tournament.name}
        </h1>

        <div className="mt-2 flex items-center gap-1.5 text-[15px] font-medium text-gray-500">
          <MapPinIcon className="h-4 w-4 shrink-0 text-emerald-600" />
          {tournament.venue_slug && citySlug ? (
            <Link
              href={`/${citySlug}/venues/${tournament.venue_slug}`}
              className="font-semibold text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-2 hover:decoration-emerald-600"
            >
              {venueName}
            </Link>
          ) : (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-2 hover:decoration-emerald-600"
            >
              {tournament.location_name}
            </a>
          )}
        </div>

        {/* Stat strip — divided, no boxes-on-boxes */}
        <div className="mt-5 grid grid-cols-3 divide-x divide-gray-100 overflow-hidden rounded-2xl border border-gray-200/80 bg-white">
          {stats.map((s) => (
            <div key={s.label} className="px-2 py-3 text-center">
              <div className="text-xl font-extrabold tracking-tight text-gray-900">
                {s.value}
              </div>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Field-strength overview — the summary the long event list lacks */}
        {fs && (
          <div className={`mt-3 rounded-2xl px-4 py-3 ring-1 ${fs.box} ${fs.ring}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Field strength
              </span>
              <span className={`text-sm font-extrabold ${fs.text}`}>{fs.label}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/[0.07]">
              <div className={`h-full rounded-full ${fs.bar}`} style={{ width: `${fsFill}%` }} />
            </div>
            {tournament.max_sandbagger_pct != null && tournament.max_sandbagger_pct > 0 && (
              <p className="mt-2 text-xs font-medium text-gray-500">
                <span className={`font-bold ${fs.text}`}>
                  {Math.round(tournament.max_sandbagger_pct * 100)}%
                </span>{" "}
                of players rated over the skill cap
              </p>
            )}
          </div>
        )}

        {/* Primary CTA */}
        {withUrl.length > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            {withUrl.map((source) => {
              const label = SOURCE_DISPLAY_NAMES[source.source_platform] ?? "source";
              return closed || past ? (
                <a
                  key={source.id}
                  href={source.registration_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logRegister(source.source_platform)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-200 px-5 py-3.5 text-base font-bold text-gray-600 transition active:scale-[0.98]"
                >
                  View on {label} <ArrowRightIcon className="h-4 w-4" />
                </a>
              ) : (
                <a
                  key={source.id}
                  href={source.registration_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logRegister(source.source_platform)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-base font-bold text-white shadow-[0_12px_28px_-12px_rgba(6,78,59,0.6)] transition hover:bg-emerald-800 active:scale-[0.98]"
                >
                  Register on {label} <ArrowRightIcon className="h-4 w-4" />
                </a>
              );
            })}
            <div className="flex justify-center">
              <RegistrationPill tournament={tournament} />
            </div>
          </div>
        )}

        {/* Secondary actions — tactile icon buttons */}
        <div className="mt-3 flex items-stretch gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-[13px] font-bold text-gray-700 transition hover:border-emerald-300 hover:text-emerald-700 active:scale-[0.97]"
          >
            <MapPinIcon className="h-4 w-4" /> Map
          </a>
          <a
            href={googleCalendarUrl(tournament)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-[13px] font-bold text-gray-700 transition hover:border-emerald-300 hover:text-emerald-700 active:scale-[0.97]"
          >
            <CalendarIcon className="h-4 w-4" /> Calendar
          </a>
          <div className="flex flex-1 items-stretch [&>*]:w-full [&_button]:w-full [&_button]:justify-center [&_button]:rounded-xl [&_button]:border [&_button]:border-gray-200 [&_button]:bg-white [&_button]:py-2.5 [&_button]:text-[13px] [&_button]:font-bold [&_button]:text-gray-700">
            <ShareButtons
              tournamentId={tournament.id}
              tournamentName={tournament.name}
              dateRange={formatDateRange(tournament.date_start, tournament.date_end)}
              venue={venueName}
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

/** Branded hero fallback when the venue has no photo (mirrors the card). */
function HeroFallback({ venueName }: { venueName: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(120%_130%_at_80%_10%,#0a7d5a,#064c39_72%)]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 160"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g fill="none" stroke="#fff" strokeOpacity="0.11" strokeWidth="1.4">
          <circle cx="320" cy="26" r="70" />
          <circle cx="320" cy="26" r="130" />
          <circle cx="320" cy="26" r="190" />
        </g>
        <path d="M320 26 L190 26 A130 130 0 0 1 320 -104 Z" fill="#d4af37" fillOpacity="0.08" />
      </svg>
      <RadarMarkIcon className="absolute left-5 top-1/2 h-11 w-11 -translate-y-1/2 text-white/90" />
    </div>
  );
}
