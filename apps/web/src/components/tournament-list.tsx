import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { isTournamentPast, tournamentEndDate } from "@/lib/format";
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

function SectionLabel({
  children,
  count,
  tone = "live",
}: {
  children: React.ReactNode;
  count: number;
  tone?: "live" | "past";
}) {
  return (
    <div className="flex items-baseline gap-3 mt-2 mb-3">
      <h2 className="t-label text-gray-500">
        <span className="relative inline-block">
          <span>{children}</span>
          <span
            className={`absolute -bottom-0.5 left-0 right-0 h-[2px] origin-left animate-underline ${
              tone === "past" ? "bg-gray-300" : "bg-emerald-700"
            }`}
          />
        </span>
      </h2>
      <span className="t-caption text-gray-300">{count}</span>
      <div className="flex-1 border-t border-gray-200" />
    </div>
  );
}

export function TournamentList({ tournaments, citySlug }: { tournaments: Tournament[]; citySlug?: string }) {
  if (tournaments.length === 0) {
    return (
      <div className="animate-fade-up rounded-2xl border border-gray-200/70 bg-white p-16 text-center shadow-card">
        <div className="inline-block animate-paddle">
          <span className="block text-5xl" aria-hidden="true">{"\u{1F3D3}"}</span>
        </div>
        <p className="mt-4 t-h2 font-bold text-gray-400">
          Nothing matching — yet.
        </p>
        <p className="mt-1 t-body text-gray-400">
          Try clearing filters, or check back tomorrow.
        </p>
        <p className="mt-6 t-body text-gray-500">
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

  // Past tournaments (ended before today) are pulled out first — they live in a
  // separate, clearly-secondary "Recent results" section so they don't pose as
  // live events. Only what's left gets bucketed into the upcoming sections.
  const upcoming: Tournament[] = [];
  const recent: Tournament[] = [];
  for (const t of tournaments) {
    if (isTournamentPast(t, now)) recent.push(t);
    else upcoming.push(t);
  }
  recent.sort(
    (a, b) => tournamentEndDate(b).getTime() - tournamentEndDate(a).getTime(),
  );

  const thisWeek: Tournament[] = [];
  const later: Tournament[] = [];
  for (const t of upcoming) {
    if (isThisWeek(t, now)) thisWeek.push(t);
    else later.push(t);
  }

  const groups = [
    { key: "week", label: "This Week", items: thisWeek, past: false },
    { key: "later", label: "Coming Up", items: later, past: false },
    { key: "recent", label: "Recent results", items: recent, past: true },
  ].filter((g) => g.items.length > 0);

  // A single group reads fine as a plain grid with no section label.
  if (groups.length === 1) {
    return (
      <CardGrid items={groups[0].items} citySlug={citySlug} dimmed={groups[0].past} />
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <div key={g.key}>
          <SectionLabel count={g.items.length} tone={g.past ? "past" : "live"}>
            {g.label}
          </SectionLabel>
          <CardGrid items={g.items} citySlug={citySlug} dimmed={g.past} />
        </div>
      ))}
    </div>
  );
}

function CardGrid({
  items,
  citySlug,
  dimmed = false,
}: {
  items: Tournament[];
  citySlug?: string;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${dimmed ? "opacity-75" : ""}`}
    >
      {items.map((t, i) => (
        <div key={t.id} className={`h-full ${staggerClass(i)}`}>
          <TournamentCard tournament={t} citySlug={citySlug} />
        </div>
      ))}
    </div>
  );
}
