import Link from "next/link";
import type { TournamentEvent } from "@/lib/types";
import { IntelSectionHeader } from "@/components/intel-section-header";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function TournamentPodium({ events }: { events: TournamentEvent[] }) {
  const eventsWithPlacements = events.filter(
    (e) => e.players?.some((p) => p.placement != null),
  );

  if (eventsWithPlacements.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      <IntelSectionHeader title="Results" />
      <div className="divide-y divide-gray-100 bg-white">
        {eventsWithPlacements.map((event) => {
          const medalists = (event.players ?? [])
            .filter((p) => p.placement != null)
            .sort((a, b) => a.placement! - b.placement!);

          return (
            <div key={event.id} className="px-4 sm:px-5 py-4">
              <h4 className="text-sm font-bold text-gray-900 mb-3">{event.name}</h4>
              <div className="flex flex-col gap-2">
                {medalists.map((p) => {
                  const names = [p.player_name, p.partner_name].filter(Boolean).join(" & ");
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-lg">{MEDAL[p.placement!]}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-gray-800">{names}</span>
                      </div>
                      {p.player_id && (
                        <Link
                          href={`/results/${event.id}/${p.player_id}`}
                          className="shrink-0 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          Share →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
