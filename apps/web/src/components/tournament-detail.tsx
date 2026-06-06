"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Tournament, TournamentSource, TournamentEvent } from "@/lib/types";
import {
  formatDateRange,
  formatCurrency,
  relativeDate,
  googleMapsUrl,
  isTournamentPast,
} from "@/lib/format";
import { eventIntel, ratingHistogram } from "@/lib/field-intel";
import { cleanEventName } from "@/lib/event-name";
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
  ArrowRightIcon,
  MedalIcon,
  LockIcon,
  RadarMarkIcon,
} from "./icons";

const FS_LABEL: Record<FieldStrengthLevel, string> = {
  friendly: "Friendly field",
  competitive: "Competitive field",
  stacked: "Stacked field",
  sandbagger: "Over-cap field",
};

/** A quiet one-line read of the field, shown in the overview and linking to the
 *  Field Intelligence section. Single bracket → that field's verdict; multiple
 *  brackets → a roll-up that leads with the over-cap alarm. */
type IntelLine = { tone: "good" | "alert"; strong: string; detail: string };

function overviewIntel(events: TournamentEvent[]): IntelLine | null {
  const withData = events.filter((e) => (e.players?.length ?? 0) > 0);
  if (withData.length === 0) return null;

  if (withData.length === 1) {
    const e = withData[0];
    const intel = eventIntel(e);
    if (intel.above > 0) {
      return {
        tone: "alert",
        strong: "Over-cap field",
        detail: `${intel.above} rating${intel.above > 1 ? "s" : ""} over the cap`,
      };
    }
    const avg = ratingHistogram(e).avg;
    let lvl = getFieldStrengthLevel(e.field_strength ?? undefined, e.sandbagger_pct ?? undefined);
    // Fallback when no stored strength score: infer from headroom under the cap.
    if (!lvl && avg != null && e.skill_level_max != null) {
      const headroom = e.skill_level_max - avg;
      lvl = headroom >= 0.5 ? "friendly" : headroom >= 0.2 ? "competitive" : "stacked";
    }
    const strong = lvl ? FS_LABEL[lvl] : "Field intel";
    const tail =
      intel.delta != null && Math.abs(intel.delta) >= 0.18
        ? `plays ${Math.abs(intel.delta).toFixed(2)} ${intel.delta >= 0 ? "above" : "below"} its listed level`
        : "plays true to level";
    return { tone: "good", strong, detail: avg != null ? `true avg ${avg.toFixed(2)} · ${tail}` : tail };
  }

  const overCap = withData.filter((e) => eventIntel(e).above > 0).length;
  if (overCap > 0) {
    return {
      tone: "alert",
      strong: "Heads up",
      detail: `${overCap} of ${withData.length} brackets have ratings over the cap`,
    };
  }
  return { tone: "good", strong: "All clear", detail: `${withData.length} brackets · every field plays true to level` };
}

/** Shared, derived view-model for a tournament's detail UI. Computed once and
 *  threaded into the Hero / Overview so they stay consistent and the page can
 *  place them in different grid cells without recomputing. */
function useTournamentView(
  tournament: Tournament,
  sources: TournamentSource[],
  events: TournamentEvent[],
) {
  const withUrl = sources.filter((s) => s.registration_url);
  const relative = relativeDate(tournament.date_start);
  const mapsUrl = googleMapsUrl({
    latitude: tournament.latitude,
    longitude: tournament.longitude,
    address: tournament.location_address,
    name: tournament.location_name,
  });

  const primarySource = withUrl[0];
  const regStatus = getRegistrationStatus(tournament);
  const past = isTournamentPast(tournament);
  const closed = !past && regStatus.isClosed;
  const venueName = tournament.venue_name || tournament.location_name;
  const intel = overviewIntel(events);
  const eyebrow =
    events.length === 0
      ? null
      : events.length === 1
        ? cleanEventName(events[0])
        : `${events.length} divisions`;
  const shortDate = new Date(tournament.date_start + "T00:00:00").toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" },
  );

  function logRegister(source: string) {
    track("register_button_clicked", {
      tournamentId: tournament.id,
      sourcePlatform: source,
      registrationClosed: regStatus.isClosed,
    });
  }

  const facts: { label: string; value: string; accent?: boolean }[] = [
    { label: "Entry", value: tournament.entry_fee != null ? formatCurrency(tournament.entry_fee) : "—", accent: true },
    { label: "Registered", value: tournament.total_registered ? String(tournament.total_registered) : "—" },
    { label: "Events", value: tournament.event_count ? String(tournament.event_count) : "—" },
    { label: "Date", value: shortDate },
  ];

  return {
    withUrl,
    relative,
    mapsUrl,
    primarySource,
    regStatus,
    past,
    closed,
    venueName,
    intel,
    eyebrow,
    facts,
    logRegister,
  };
}

type ViewProps = {
  tournament: Tournament;
  sources: TournamentSource[];
  events?: TournamentEvent[];
  citySlug?: string;
};

/** Draft banner + on-scroll sticky action bar + the view-tracking effect.
 *  Rendered once per page; placement-independent (fixed / flow-level chrome). */
export function TournamentChrome({
  tournament,
  sources,
  events = [],
}: ViewProps) {
  const { primarySource, closed, past, venueName, regStatus, logRegister } =
    useTournamentView(tournament, sources, events);

  const [stickyVisible, setStickyVisible] = useState(false);
  useEffect(() => {
    function onScroll() {
      setStickyVisible(window.scrollY > 280);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    track("tournament_viewed", {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      registrationClosed: regStatus.isClosed,
      eventCount: tournament.event_count,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament.id]);

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
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-3 py-2.5 sm:px-5 lg:max-w-7xl">
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
    </>
  );
}

/** Hero: venue photo or branded fallback. Full-bleed banner on mobile; on the
 *  page's lg grid the page reshapes it into the right-column banner. */
export function TournamentHero({
  tournament,
  sources,
  events = [],
}: ViewProps) {
  const { relative, past, closed, venueName } = useTournamentView(
    tournament,
    sources,
    events,
  );

  return (
    <div className="relative -mx-3 aspect-[16/10] overflow-hidden bg-emerald-900 sm:-mx-5 sm:aspect-[5/2] sm:rounded-2xl lg:mx-0 lg:aspect-[21/9] lg:rounded-3xl">
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
  );
}

/** Overview / briefing rail: identity + intel one-liner + fact row + Register
 *  CTA + pill + Map/Cal/Share. On mobile it overlaps the hero (-mt-8/-mt-14);
 *  on the page's lg grid the page neutralizes the overlap (lg:mt-0) and makes
 *  it a sticky left rail. */
export function TournamentOverview({
  tournament,
  sources,
  events = [],
  citySlug,
}: ViewProps) {
  const {
    withUrl,
    mapsUrl,
    closed,
    past,
    venueName,
    intel,
    eyebrow,
    facts,
    logRegister,
  } = useTournamentView(tournament, sources, events);

  return (
    <div className="relative z-10 mx-auto -mt-8 max-w-3xl sm:-mt-14 lg:mx-0 lg:mt-0 lg:max-w-none">
      <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-card sm:rounded-3xl sm:p-7">
        {eyebrow && <div className="t-label text-emerald-700">{eyebrow}</div>}

        <h1 className="mt-1.5 t-h1 text-gray-900">{tournament.name}</h1>

        <div className="mt-2 flex items-center gap-1.5 t-small font-medium text-gray-500">
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

        {/* Quiet field-intel one-liner → Field Intelligence */}
        {intel && (
          <a
            href="#field-intelligence"
            className={`mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 t-small font-medium transition hover:opacity-75 ${
              intel.tone === "alert" ? "text-red-700/80" : "text-gray-500"
            }`}
          >
            <span
              className={`h-[7px] w-[7px] shrink-0 rounded-full ring-[3px] ${
                intel.tone === "alert" ? "bg-red-500 ring-red-100" : "bg-emerald-500 ring-emerald-100"
              }`}
            />
            <span className={`font-bold ${intel.tone === "alert" ? "text-red-700" : "text-emerald-800"}`}>
              {intel.strong}
            </span>
            <span className="text-gray-300">·</span>
            <span className="tabular-nums">{intel.detail}</span>
            <span className="ml-0.5 hidden items-center gap-0.5 font-bold text-emerald-700 sm:inline-flex">
              See the field <ArrowRightIcon className="h-3 w-3" />
            </span>
          </a>
        )}

        {/* Editorial fact row — uniform, hairline-divided */}
        <div className="mt-5 grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100 pt-4">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0 px-2.5 first:pl-0 last:pr-0">
              <div className="t-label text-gray-400">{f.label}</div>
              <div className={`mt-1 t-h3 tabular-nums ${f.accent ? "text-emerald-800" : "text-gray-900"}`}>
                {f.value}
              </div>
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        {withUrl.length > 0 && (
          <div className="mt-5 flex flex-col gap-2.5">
            {withUrl.map((source) => {
              const label = SOURCE_DISPLAY_NAMES[source.source_platform] ?? "source";
              return closed || past ? (
                <a
                  key={source.id}
                  href={source.registration_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logRegister(source.source_platform)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-200 px-5 py-3.5 t-body font-bold text-gray-600 transition active:scale-[0.98]"
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 t-body font-bold text-white shadow-[0_12px_28px_-12px_rgba(6,78,59,0.6)] transition hover:bg-emerald-800 active:scale-[0.98]"
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

        {/* Secondary actions — aligned 3-up */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 t-small font-bold text-gray-700 transition hover:border-emerald-300 hover:text-emerald-700 active:scale-[0.97]"
          >
            <MapPinIcon className="h-4 w-4" /> Map
          </a>
          <a
            href={googleCalendarUrl(tournament)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 t-small font-bold text-gray-700 transition hover:border-emerald-300 hover:text-emerald-700 active:scale-[0.97]"
          >
            <CalendarIcon className="h-4 w-4" /> Calendar
          </a>
          <div className="flex items-stretch [&>*]:w-full [&_button]:w-full [&_button]:justify-center [&_button]:gap-1.5 [&_button]:rounded-xl [&_button]:border [&_button]:border-gray-200 [&_button]:bg-white [&_button]:py-2.5 [&_button]:text-[13px] [&_button]:font-bold [&_button]:text-gray-700">
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
    </div>
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
