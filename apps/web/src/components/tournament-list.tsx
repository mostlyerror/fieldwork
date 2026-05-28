import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { TournamentCard } from "./tournament-card";

function isThisWeek(t: Tournament, now: Date): boolean {
  const start = new Date(t.date_start + "T00:00:00");
  const sevenOut = new Date(now);
  sevenOut.setDate(sevenOut.getDate() + 7);
  return start <= sevenOut;
}

function SectionLabel({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div className="flex items-baseline gap-3 mt-2 mb-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
        {children}
      </h2>
      <span className="text-xs text-gray-300">{count}</span>
      <div className="flex-1 border-t border-gray-200" />
    </div>
  );
}

export function TournamentList({ tournaments, citySlug }: { tournaments: Tournament[]; citySlug?: string }) {
  if (tournaments.length === 0) {
    return (
      <div className="rounded-xl bg-white p-16 text-center shadow-sm">
        <p className="text-4xl" aria-hidden="true">{"\u{1F3D3}"}</p>
        <p className="mt-4 text-lg font-bold text-gray-300">
          No tournaments found
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Try adjusting your filters or check back soon!
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Know about an upcoming tournament?{" "}
          <Link
            href="/submit"
            className="inline-flex items-center gap-1 rounded-xl bg-green-600 px-3.5 py-1.5 font-semibold text-white transition-colors hover:bg-green-700"
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
        {tournaments.map((t) => (
          <TournamentCard key={t.id} tournament={t} citySlug={citySlug} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel count={thisWeek.length}>This Week</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {thisWeek.map((t) => (
            <TournamentCard key={t.id} tournament={t} citySlug={citySlug} />
          ))}
        </div>
      </div>
      <div>
        <SectionLabel count={later.length}>Coming Up</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {later.map((t) => (
            <TournamentCard key={t.id} tournament={t} citySlug={citySlug} />
          ))}
        </div>
      </div>
    </div>
  );
}
