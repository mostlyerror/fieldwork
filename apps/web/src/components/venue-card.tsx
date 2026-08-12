import Link from "next/link";
import type { VenueCardModel } from "@/lib/venue-stats";
import { cadenceLine, shortDate } from "@/lib/venue-stats";
import { RadarMarkIcon } from "./icons";

export function VenueCard({ venue: v, citySlug }: { venue: VenueCardModel; citySlug: string }) {
  const hasUpcoming = v.upcomingCount > 0;
  return (
    <Link
      href={`/${citySlug}/venues/${v.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-card transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-card-hover motion-reduce:hover:transform-none"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-emerald-900">
        {v.photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.photoUrl}
              alt={v.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.045]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/20" />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(120%_130%_at_80%_10%,#0a7d5a,#064c39_72%)]">
            <RadarMarkIcon className="h-9 w-9 text-white/80" />
            <span className="t-label text-white/80">{v.name}</span>
          </div>
        )}
        {hasUpcoming && v.nextDate && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-xs font-bold text-gray-900 backdrop-blur">
            <span className="font-extrabold text-emerald-700">Next</span>
            {shortDate(v.nextDate)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[17px] font-extrabold leading-snug tracking-[-0.015em] text-gray-900">{v.name}</h3>
        {v.shortCity && <p className="t-small mt-0.5 text-gray-500">{v.shortCity}</p>}
        <p className="t-small mt-2 flex items-center gap-2 font-semibold text-gray-700">
          <span
            className={`h-[7px] w-[7px] shrink-0 rounded-full ${
              hasUpcoming ? "bg-emerald-500 ring-[3px] ring-emerald-100" : "bg-gray-400 ring-[3px] ring-gray-100"
            }`}
          />
          {cadenceLine(v)}
        </p>
      </div>
    </Link>
  );
}
