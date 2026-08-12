import { BackLink } from "./back-link";
import { RadarMarkIcon } from "./icons";

/**
 * Full-bleed venue photo hero with floating back pill and Places attribution.
 * No photo → branded radar fallback (mirrors tournament-detail's HeroFallback),
 * so the layout is identical either way.
 */
export function VenueHero({
  photoUrl,
  venueName,
  backHref,
  backLabel,
}: {
  photoUrl: string | null;
  venueName: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="relative -mx-3 aspect-[4/3] overflow-hidden bg-emerald-900 sm:-mx-5 sm:aspect-[5/2] sm:rounded-2xl lg:mx-0 lg:aspect-[21/9] lg:rounded-3xl">
      {photoUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt={venueName} className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/0 to-black/25" />
          <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-white/75 backdrop-blur-sm">
            Photo · Google
          </span>
        </>
      ) : (
        <HeroFallback venueName={venueName} />
      )}
      <BackLink
        fallbackHref={backHref}
        fallbackLabel={backLabel}
        className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/92 px-3 py-1.5 text-[13px] font-bold text-gray-900 backdrop-blur hover:bg-white"
      />
    </div>
  );
}

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
      <span className="sr-only">{venueName}</span>
    </div>
  );
}
