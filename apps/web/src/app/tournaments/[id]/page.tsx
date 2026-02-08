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
    <>
      <Link
        href="/"
        className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to tournaments
      </Link>
      <TournamentDetail
        tournament={tournament}
        sources={sources}
        miniMap={miniMap}
      />
    </>
  );
}
