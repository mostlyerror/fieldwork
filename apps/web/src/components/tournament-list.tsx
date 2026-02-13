import Link from "next/link";
import type { Tournament } from "@/lib/types";
import { TournamentCard } from "./tournament-card";

export function TournamentList({ tournaments }: { tournaments: Tournament[] }) {
  if (tournaments.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-16 text-center shadow-sm">
        <p className="text-4xl">{"\u{1F3D3}"}</p>
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
            className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3.5 py-1.5 font-semibold text-white transition-colors hover:bg-green-700"
          >
            Submit it
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tournaments.map((t) => (
        <TournamentCard key={t.id} tournament={t} />
      ))}
    </div>
  );
}
