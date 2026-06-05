import { MapPinIcon, RadarMarkIcon } from "@/components/icons";
import type { IdentityBandProps } from "./types";

/** Small verified seal (check in a disc) — inline so it reads on the dark band. */
function VerifiedSeal({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      <path
        d="M4.6 8.2 7 10.5l4.4-5"
        stroke="#06382b"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One rating cell (Doubles / Singles) rendered as a light stat tile on the band. */
function RatingCell({
  label,
  value,
  verified,
}: {
  label: string;
  value: number | null;
  verified: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/12 bg-white/[0.07] px-3.5 py-3 sm:px-4">
      <div className="flex items-center gap-1.5">
        <span className="t-label text-emerald-100/70">{label}</span>
        {value != null && verified && (
          <VerifiedSeal className="h-3.5 w-3.5 text-emerald-300" />
        )}
      </div>
      {value != null ? (
        <div className="mt-1 t-h1 tabular-nums text-white">{value.toFixed(2)}</div>
      ) : (
        <div className="mt-1 t-h1 tabular-nums text-white/30">--</div>
      )}
    </div>
  );
}

/**
 * IdentityBand — the scouting header. A full-width deep-emerald banner card
 * carrying the player's identity (name, location, freshness) and the two core
 * signals (Doubles / Singles DUPR) as light stat tiles, with a form chip.
 */
export function IdentityBand({
  name,
  location,
  duprDoubles,
  duprSingles,
  doublesVerified,
  singlesVerified,
  formLabel,
  lastUpdated,
}: IdentityBandProps) {
  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(130%_140%_at_82%_-10%,#0a7d5a,#064c39_70%)] shadow-card">
      {/* Radar-ring motif + gold sweep, echoing the tournament hero. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 400 220"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g fill="none" stroke="#fff" strokeOpacity="0.09" strokeWidth="1.4">
          <circle cx="338" cy="20" r="70" />
          <circle cx="338" cy="20" r="130" />
          <circle cx="338" cy="20" r="200" />
        </g>
        <path
          d="M338 20 L198 20 A140 140 0 0 1 338 -120 Z"
          fill="#d4af37"
          fillOpacity="0.07"
        />
      </svg>

      <div className="relative p-5 sm:p-7">
        {/* Identity */}
        <div className="flex items-start gap-3">
          <RadarMarkIcon className="mt-0.5 hidden h-9 w-9 shrink-0 text-white/85 sm:block" />
          <div className="min-w-0 flex-1">
            <h1 className="t-h1 text-balance text-white">{name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {location && (
                <span className="inline-flex items-center gap-1 t-small font-medium text-emerald-100/75">
                  <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-emerald-200/80" />
                  {location}
                </span>
              )}
              {location && updatedLabel && (
                <span className="text-emerald-200/30">·</span>
              )}
              {updatedLabel && (
                <span className="t-caption text-emerald-100/55">
                  Updated {updatedLabel}
                </span>
              )}
            </div>

            {formLabel && (
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 t-label text-emerald-50 ring-1 ring-inset ring-white/15">
                <span className="h-[6px] w-[6px] rounded-full bg-emerald-300 ring-[3px] ring-emerald-300/20" />
                {formLabel}
              </span>
            )}
          </div>
        </div>

        {/* Signal — the two ratings */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
          <RatingCell
            label="Doubles"
            value={duprDoubles}
            verified={doublesVerified}
          />
          <RatingCell
            label="Singles"
            value={duprSingles}
            verified={singlesVerified}
          />
        </div>
      </div>
    </div>
  );
}
