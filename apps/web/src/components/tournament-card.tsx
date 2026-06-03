import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { formatDateRange, formatCurrency, isTournamentPast } from "@/lib/format";
import { getFieldStrengthLevel, type FieldStrengthLevel } from "./field-strength-badge";
import { getRegistrationStatus, formatUrgency } from "@/lib/registration";
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  ClockIcon,
  ArrowRightIcon,
  LockIcon,
  MedalIcon,
  RadarMarkIcon,
} from "./icons";

/** Color system keyed to the field-strength level (the card's only accent). */
const FS_TONE: Record<
  FieldStrengthLevel,
  { label: string; text: string; bar: string; box: string; ring: string }
> = {
  friendly: { label: "Friendly field", text: "text-emerald-700", bar: "bg-emerald-600", box: "bg-emerald-50", ring: "ring-emerald-100" },
  competitive: { label: "Competitive", text: "text-amber-700", bar: "bg-amber-500", box: "bg-amber-50", ring: "ring-amber-100" },
  stacked: { label: "Stacked", text: "text-red-700", bar: "bg-red-500", box: "bg-red-50", ring: "ring-red-100" },
  sandbagger: { label: "Sandbagger alert", text: "text-red-700", bar: "bg-red-500", box: "bg-red-50", ring: "ring-red-100" },
};

export function TournamentCard({
  tournament: t,
  citySlug,
}: {
  tournament: Tournament;
  citySlug?: string;
}) {
  const slug = citySlug ?? "";
  const href = slug ? `/${slug}/tournaments/${t.id}` : `/tournaments/${t.id}`;

  const past = isTournamentPast(t);
  const reg = getRegistrationStatus(t);
  const closed = !past && reg.isClosed;
  const urgency = !past && !closed ? formatUrgency(reg.msUntil) : null;

  const fsLevel = getFieldStrengthLevel(t.avg_field_strength, t.max_sandbagger_pct);
  const fs = fsLevel ? FS_TONE[fsLevel] : null;
  const fsFill = Math.round(Math.min(1, Math.max(0.12, t.avg_field_strength ?? 0)) * 100);

  const venueName = t.venue_name || t.location_name;
  const dateLine =
    formatDateRange(t.date_start, t.date_end) +
    (t.event_count ? ` · ${t.event_count} event${t.event_count !== 1 ? "s" : ""}` : "");

  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_18px_40px_-24px_rgba(6,40,30,0.28)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_30px_56px_-28px_rgba(6,40,30,0.36)] motion-reduce:hover:transform-none"
    >
      {/* ── Banner: venue photo, or branded fallback ── */}
      <div className="relative aspect-[16/9] overflow-hidden bg-emerald-900">
        {t.venue_photo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={t.venue_photo_url}
            alt={venueName}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
          />
        ) : (
          <Fallback venueName={venueName} />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/15" />

        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-xs font-bold text-gray-900 backdrop-blur">
          <CalendarIcon className="h-3.5 w-3.5 text-emerald-700" />
          {formatDateRange(t.date_start, t.date_end)}
        </span>

        {past ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur">
            <MedalIcon className="h-3.5 w-3.5" />
            Final
          </span>
        ) : closed ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur">
            <LockIcon className="h-3.5 w-3.5" />
            Closed
          </span>
        ) : t.entry_fee != null ? (
          <span className="absolute right-3 top-3 rounded-lg bg-emerald-900 px-2.5 py-1 text-sm font-extrabold text-white">
            {formatCurrency(t.entry_fee)}
          </span>
        ) : null}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
          <CalendarIcon className="h-3 w-3" />
          <span className="truncate">{dateLine}</span>
        </div>

        <h3 className="text-lg font-extrabold leading-snug tracking-tight text-gray-900">
          {t.name}
        </h3>

        <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-gray-500">
          <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="truncate">{venueName}</span>
        </p>

        {/* Honest field-strength gauge — the differentiator, shown only with real intel */}
        {fs && (
          <div className={`mt-3 rounded-xl px-3 py-2.5 ring-1 ${fs.box} ${fs.ring}`}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Field strength
              </span>
              <span className={`text-xs font-extrabold ${fs.text}`}>{fs.label}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
              <div className={`h-full rounded-full ${fs.bar}`} style={{ width: `${fsFill}%` }} />
            </div>
            {t.max_sandbagger_pct != null && t.max_sandbagger_pct > 0 && (
              <p className="mt-1.5 text-[11px] font-medium text-gray-500">
                <span className={`font-bold ${fs.text}`}>
                  {Math.round(t.max_sandbagger_pct * 100)}%
                </span>{" "}
                rated over the skill cap
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-gray-400">
            {past ? (
              <>
                <MedalIcon className="h-3.5 w-3.5" />
                Results posted
              </>
            ) : closed ? (
              <>
                <LockIcon className="h-3.5 w-3.5" />
                Registration closed
              </>
            ) : urgency ? (
              <>
                <ClockIcon className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-amber-700">{urgency}</span>
              </>
            ) : t.total_registered ? (
              <>
                <UsersIcon className="h-3.5 w-3.5" />
                {t.total_registered} registered
              </>
            ) : null}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-1.5 text-[12.5px] font-bold text-white transition-all duration-200 group-hover:gap-2 group-hover:bg-emerald-800">
            {past ? "See results" : "View intel"}
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Branded panel shown when a venue has no photo (≈40% of venues). Looks
 *  deliberate, not broken — so a photo-less card sits as a sibling next to one
 *  with a photo. Emerald gradient + radar-ring motif + mark + venue name. */
function Fallback({ venueName }: { venueName: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(120%_130%_at_78%_12%,#0a7d5a,#064c39_72%)]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 300 170"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g fill="none" stroke="#fff" strokeOpacity="0.12" strokeWidth="1.3">
          <circle cx="232" cy="28" r="54" />
          <circle cx="232" cy="28" r="100" />
          <circle cx="232" cy="28" r="148" />
        </g>
        <path d="M232 28 L132 28 A100 100 0 0 1 232 -72 Z" fill="#d4af37" fillOpacity="0.08" />
      </svg>
      <RadarMarkIcon className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/90" />
      <span className="absolute bottom-2.5 left-3 right-3 truncate text-[11px] font-bold text-white/85">
        {venueName}
      </span>
    </div>
  );
}
