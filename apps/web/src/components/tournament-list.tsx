import type { Tournament } from "@/lib/types";
import { TournamentCard } from "./tournament-card";

export function TournamentList({ tournaments }: { tournaments: Tournament[] }) {
  if (tournaments.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-gray-500">No tournaments found</p>
        <p className="mt-1 text-sm text-gray-400">
          Try adjusting your filters
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
