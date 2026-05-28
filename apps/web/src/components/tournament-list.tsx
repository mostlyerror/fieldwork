import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { TournamentCard } from "./tournament-card";

function isThisWeek(t: Tournament, now: Date): boolean {
  const start = new Date(t.date_start + "T00:00:00");
  const sevenOut = new Date(now);
  sevenOut.setDate(sevenOut.getDate() + 7);
  return start <= sevenOut;
}

function staggerClass(i: number): string {
  // Caps at stagger-9; later cards just fade without delay
  if (i === 0) return "animate-fade-up";
  if (i > 9) return "animate-fade-up";
  return `animate-fade-up stagger-${i}`;
}

function SectionLabel({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div className="flex items-baseline gap-3 mt-2 mb-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
        <span className="relative inline-block">
          <span>{children}</span>
          <span className="absolute -bottom-0.5 left-0 right-0 h-[2px] bg-emerald-700 origin-left animate-underline" />
        </span>
      </h2>
      <span className="text-xs text-gray-300">{count}</span>
      <div className="flex-1 border-t border-gray-200" />
    </div>
  );
}

export function TournamentList({ tournaments, citySlug }: { tournaments: Tournament[]; citySlug?: string }) {
  if (tournaments.length === 0) {
    return (
      <div className="animate-fade-up rounded-xl bg-white p-16 text-center shadow-sm">
        <div className="inline-block animate-paddle">
          <span className="block text-5xl" aria-hidden="true">{"\u{1F3D3}"}</span>
        </div>
        <p className="mt-4 text-lg font-bold text-gray-400">
          Nothing matching — yet.
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Try clearing filters, or check back tomorrow.
        </p>
        <p className="mt-6 text-sm text-gray-500">
          Know one we&apos;re missing?{" "}
          <Link
            href="/submit"
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3.5 py-1.5 font-semibold text-white transition-all hover:bg-emerald-800 hover:scale-105"
          >
            Submit it
          </Link>
        </p>
      </div>
    );
  }

  const now = new Date();
  const thisWeek: Tournament[] = [];
  const later: Tournament[] = [];
  for (const t of tournaments) {
    if (isThisWeek(t, now)) thisWeek.push(t);
    else later.push(t);
  }

  // If everything is "this week" or none are, skip the section labels — show flat grid
  if (thisWeek.length === 0 || later.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((t, i) => (
          <div key={t.id} className={`h-full ${staggerClass(i)}`}>
            <TournamentCard tournament={t} citySlug={citySlug} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel count={thisWeek.length}>This Week</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {thisWeek.map((t, i) => (
            <div key={t.id} className={`h-full ${staggerClass(i)}`}>
              <TournamentCard tournament={t} citySlug={citySlug} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel count={later.length}>Coming Up</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {later.map((t, i) => (
            <div key={t.id} className={`h-full ${staggerClass(i)}`}>
              <TournamentCard tournament={t} citySlug={citySlug} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
