import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPlayer, getPlayerTournamentHistory } from "@/lib/queries";
import { ServerHeader } from "@/components/server-header";
import { getDefaultCity } from "@/lib/cities";

export const revalidate = 600;

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) return { title: "Player Not Found" };

  const duprStr = player.dupr_doubles != null ? ` — DUPR ${player.dupr_doubles.toFixed(2)}` : "";
  return {
    title: `${player.name}${duprStr} — PickleRadar`,
    description: `View ${player.name}'s pickleball tournament history and DUPR rating on PickleRadar.`,
  };
}

export default async function PlayerPage({ params }: PageProps) {
  const { id } = await params;
  const [player, history] = await Promise.all([
    getPlayer(id),
    getPlayerTournamentHistory(id),
  ]);

  if (!player) notFound();

  const city = getDefaultCity();

  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <ServerHeader city={city} />

      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link
          href={`/${city.slug}`}
          className="mb-6 inline-flex items-center text-sm text-gray-400 hover:text-emerald-700"
        >
          &larr; Back to tournaments
        </Link>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">
                {player.name}
              </h1>
              {player.location && (
                <p className="mt-1 text-sm text-gray-500">{player.location}</p>
              )}
              {player.gender && (
                <p className="text-xs text-gray-400">
                  {player.gender === "M" ? "Men's" : player.gender === "F" ? "Women's" : player.gender}
                </p>
              )}
            </div>
            {(player.dupr_doubles != null || player.dupr_singles != null) && (
              <div className="text-right">
                {player.dupr_doubles != null && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Doubles
                    </p>
                    <p className="text-3xl font-extrabold text-emerald-600">
                      {player.dupr_doubles.toFixed(2)}
                    </p>
                  </>
                )}
                {player.dupr_singles != null && (
                  <div className={player.dupr_doubles != null ? "mt-2" : ""}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Singles
                    </p>
                    <p className="text-2xl font-extrabold text-emerald-600">
                      {player.dupr_singles.toFixed(2)}
                    </p>
                  </div>
                )}
                {player.dupr_verified && (
                  <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                    Verified
                  </span>
                )}
                {player.dupr_last_checked && (
                  <p className="mt-1 text-[10px] text-gray-400">
                    Updated {new Date(player.dupr_last_checked).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 text-lg font-bold text-gray-800">
              Tournament History
            </h2>
            <div className="space-y-2">
              {history.map((h, i) => (
                <Link
                  key={`${h.tournamentId}-${h.eventName}-${i}`}
                  href={`/${city.slug}/tournaments/${h.tournamentId}`}
                  className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-emerald-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{h.tournamentName}</p>
                      <p className="text-sm text-gray-500">{h.eventName}</p>
                      {h.partnerName && (
                        <p className="text-xs text-gray-400">
                          Partner: {h.partnerName}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        {new Date(h.dateStart + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      {h.duprRating != null && (
                        <p className="text-sm font-bold text-emerald-600">
                          {h.duprRating.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {history.length === 0 && (
          <div className="mt-8 rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-gray-400">No tournament history available yet</p>
          </div>
        )}
      </main>
    </div>
  );
}
