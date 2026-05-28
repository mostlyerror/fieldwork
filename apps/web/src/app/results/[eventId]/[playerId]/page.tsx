import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getResultCardData } from "@/lib/queries";
import { ResultCardPicker } from "@/components/result-card-picker";
import { ServerHeader } from "@/components/server-header";
import { getDefaultCity } from "@/lib/cities";
import Link from "next/link";

export const revalidate = 3600;

const MEDAL: Record<number, string> = { 1: "\u{1F947}", 2: "\u{1F948}", 3: "\u{1F949}" };
const ORDINAL: Record<number, string> = {
  1: "1st Place",
  2: "2nd Place",
  3: "3rd Place",
};

type PageProps = { params: Promise<{ eventId: string; playerId: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { eventId, playerId } = await params;
  const data = await getResultCardData(eventId, playerId);
  if (!data) return { title: "Result Not Found" };

  const names = [data.playerName, data.partnerName]
    .filter(Boolean)
    .join(" & ");
  const title = `${MEDAL[data.placement]} ${names} — ${ORDINAL[data.placement]} at ${data.tournamentName}`;

  const ogImage = `https://pickleradar.app/api/result-card?eventId=${eventId}&playerId=${playerId}&style=editorial`;

  return {
    title: `${title} — PickleRadar`,
    description: `${names} placed ${ORDINAL[data.placement]} in ${data.eventName} at ${data.tournamentName}. View and share on PickleRadar.`,
    openGraph: {
      title,
      images: [{ url: ogImage, width: 1080, height: 1350 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [ogImage],
    },
  };
}

export default async function ResultPage({ params }: PageProps) {
  const { eventId, playerId } = await params;
  const data = await getResultCardData(eventId, playerId);
  if (!data) notFound();

  const city = getDefaultCity();
  const names = [data.playerName, data.partnerName]
    .filter(Boolean)
    .join(" & ");

  return (
    <div className="min-h-screen bg-background">
      <ServerHeader city={city} />
      <main className="mx-auto max-w-lg px-3 sm:px-5 py-8">
        <Link
          href={`/${city.slug}`}
          className="mb-6 inline-flex items-center text-sm text-gray-400 hover:text-emerald-700"
        >
          &larr; Back
        </Link>

        <div className="text-center mb-8">
          <div className="text-5xl mb-2">{MEDAL[data.placement]}</div>
          <h1 className="text-2xl font-extrabold text-gray-900">{names}</h1>
          <p className="text-lg font-bold text-emerald-700 mt-1">
            {ORDINAL[data.placement]}
          </p>
          <p className="text-sm text-gray-500 mt-2">{data.eventName}</p>
          <p className="text-sm text-gray-400">
            {data.tournamentName} &middot; {data.tournamentDate}
          </p>
        </div>

        <ResultCardPicker eventId={eventId} playerId={playerId} />
      </main>
    </div>
  );
}
