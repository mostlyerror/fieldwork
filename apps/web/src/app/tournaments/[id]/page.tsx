import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTournament, getTournamentSources } from "@/lib/queries";
import { TournamentDetail } from "@/components/tournament-detail";
import { MiniMapWrapper } from "@/components/mini-map-wrapper";
import { formatDateRange } from "@/lib/format";

export const revalidate = 600; // ISR: 10 minutes

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) return { title: "Tournament Not Found" };

  return {
    title: `${tournament.name} — PickleUp`,
    description: `${formatDateRange(tournament.date_start, tournament.date_end)} at ${tournament.location_name}. Find details and register for this Houston-area pickleball tournament.`,
  };
}

export default async function TournamentPage({ params }: PageProps) {
  const { id } = await params;
  const [tournament, sources] = await Promise.all([
    getTournament(id),
    getTournamentSources(id),
  ]);

  if (!tournament) notFound();

  const miniMap =
    tournament.latitude != null && tournament.longitude != null ? (
      <MiniMapWrapper
        latitude={tournament.latitude}
        longitude={tournament.longitude}
      />
    ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">{"\u{1F3D3}"}</span>
            <div>
              <span className="block text-xl font-bold text-green-700">
                PickleUp
              </span>
              <span className="block text-[11px] text-gray-400">
                Your Houston pickleball community
              </span>
            </div>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-5 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm text-gray-400 hover:text-green-700"
        >
          &larr; Back to tournaments
        </Link>
        <TournamentDetail
          tournament={tournament}
          sources={sources}
          miniMap={miniMap}
        />
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-100 bg-white/60 py-8 text-center">
        <p className="text-sm text-gray-400">
          Made with {"\u{1F49A}"} for the Houston pickleball community
        </p>
        <p className="mt-1 text-xs text-gray-300">
          Data from PickleballBrackets &middot; Pickleball Den &middot; Community
          submissions
        </p>
      </footer>
    </div>
  );
}
