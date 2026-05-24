import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTournament, getTournamentSources, getTournamentsByCity, getTournamentEvents } from "@/lib/queries";
import { getCityBySlug, getDefaultCity } from "@/lib/cities";
import { TournamentDetail } from "@/components/tournament-detail";
import { TournamentCard } from "@/components/tournament-card";
import { EventBreakdown } from "@/components/event-breakdown";
import { MiniMapWrapper } from "@/components/mini-map-wrapper";
import { ServerHeader } from "@/components/server-header";
import { formatDateRange, distanceMiles } from "@/lib/format";
import type { Tournament } from "@/lib/types";

export const revalidate = 600;

type PageProps = { params: Promise<{ city: string; id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city: citySlug, id } = await params;
  const city = getCityBySlug(citySlug);
  const tournament = await getTournament(id);
  if (!tournament) return { title: "Tournament Not Found" };

  const cityName = city?.name ?? getDefaultCity().name;
  const description = `${formatDateRange(tournament.date_start, tournament.date_end)} at ${tournament.location_name}. Find details and register for this ${cityName}-area pickleball tournament.`;

  const ogImageParams = new URLSearchParams({
    title: tournament.name,
    date: formatDateRange(tournament.date_start, tournament.date_end),
    venue: tournament.location_name,
  });
  const ogImageUrl = `https://pickleradar.app/api/og?${ogImageParams.toString()}`;

  return {
    title: `${tournament.name} — PickleRadar`,
    description,
    openGraph: {
      title: tournament.name,
      description,
      siteName: "PickleRadar",
      type: "website",
      url: `https://pickleradar.app/${citySlug}/tournaments/${id}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: tournament.name,
      description,
      images: [ogImageUrl],
    },
  };
}

function getRelatedTournaments(
  current: Tournament,
  all: Tournament[],
): Tournament[] {
  const others = all.filter((t) => t.id !== current.id);
  if (current.latitude != null && current.longitude != null) {
    return others
      .filter((t) => t.latitude != null && t.longitude != null)
      .sort(
        (a, b) =>
          distanceMiles(current.latitude!, current.longitude!, a.latitude!, a.longitude!) -
          distanceMiles(current.latitude!, current.longitude!, b.latitude!, b.longitude!),
      )
      .slice(0, 3);
  }
  return others.slice(0, 3);
}

export default async function TournamentPage({ params }: PageProps) {
  const { city: citySlug, id } = await params;
  const city = getCityBySlug(citySlug);
  if (!city) notFound();

  const [tournament, sources, cityTournaments, events] = await Promise.all([
    getTournament(id),
    getTournamentSources(id),
    getTournamentsByCity(citySlug),
    getTournamentEvents(id),
  ]);

  if (!tournament) notFound();

  const miniMap =
    tournament.latitude != null && tournament.longitude != null ? (
      <MiniMapWrapper
        latitude={tournament.latitude}
        longitude={tournament.longitude}
      />
    ) : null;

  const related = getRelatedTournaments(tournament, cityTournaments);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: tournament.name,
    startDate: tournament.date_start,
    ...(tournament.date_end && { endDate: tournament.date_end }),
    location: {
      "@type": "Place",
      name: tournament.location_name,
      ...(tournament.location_address && {
        address: tournament.location_address,
      }),
      ...(tournament.latitude != null &&
        tournament.longitude != null && {
          geo: {
            "@type": "GeoCoordinates",
            latitude: tournament.latitude,
            longitude: tournament.longitude,
          },
        }),
    },
    sport: "Pickleball",
    ...(tournament.description && { description: tournament.description }),
    ...(tournament.entry_fee != null && {
      offers: {
        "@type": "Offer",
        price: tournament.entry_fee,
        priceCurrency: "USD",
        ...(tournament.registration_url && {
          url: tournament.registration_url,
        }),
      },
    }),
    url: `https://pickleradar.app/${citySlug}/tournaments/${tournament.id}`,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ServerHeader city={city} />

      <main className="mx-auto max-w-5xl px-5 py-8">
        <Link
          href={`/${citySlug}`}
          className="mb-6 inline-flex items-center text-sm text-gray-400 hover:text-green-700"
        >
          &larr; Back to tournaments
        </Link>
        <TournamentDetail
          tournament={tournament}
          sources={sources}
          miniMap={miniMap}
        />

        {events.length > 0 && (
          <section className="mt-8">
            <EventBreakdown events={events} />
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-lg font-bold text-gray-800">
              More Upcoming Tournaments
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((t) => (
                <TournamentCard key={t.id} tournament={t} citySlug={citySlug} />
              ))}
            </div>
          </section>
        )}
        <div className="mt-12 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-5 text-center">
          <p className="text-sm text-gray-500">
            Something missing or incorrect?{" "}
            <Link
              href="/submit"
              className="font-medium text-green-600 hover:text-green-700"
            >
              Let us know
            </Link>
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Know about another tournament?{" "}
            <Link
              href="/submit"
              className="font-medium text-green-600 hover:text-green-700"
            >
              Submit it
            </Link>
          </p>
        </div>
      </main>

      <footer className="mt-16 border-t border-gray-100 bg-white/60 py-8 text-center">
        <p className="text-sm text-gray-400">
          Made with <span aria-hidden="true">{"\u{1F49A}"}</span><span className="sr-only">love</span> for the {city.name} pickleball community
        </p>
      </footer>
    </div>
  );
}
