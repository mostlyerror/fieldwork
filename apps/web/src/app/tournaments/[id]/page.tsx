import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTournament, getTournamentSources, getTournaments } from "@/lib/queries";
import { TournamentDetail } from "@/components/tournament-detail";
import { MiniMapWrapper } from "@/components/mini-map-wrapper";
import { Header } from "@/components/header";
import { formatDateRange, formatCurrency, distanceMiles } from "@/lib/format";
import type { Tournament } from "@/lib/types";

export const revalidate = 600; // ISR: 10 minutes

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) return { title: "Tournament Not Found" };

  const description = `${formatDateRange(tournament.date_start, tournament.date_end)} at ${tournament.location_name}. Find details and register for this Houston-area pickleball tournament.`;

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
      url: `https://pickleradar.app/tournaments/${id}`,
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
  const { id } = await params;
  const [tournament, sources, allTournaments] = await Promise.all([
    getTournament(id),
    getTournamentSources(id),
    getTournaments(),
  ]);

  if (!tournament) notFound();

  const miniMap =
    tournament.latitude != null && tournament.longitude != null ? (
      <MiniMapWrapper
        latitude={tournament.latitude}
        longitude={tournament.longitude}
      />
    ) : null;

  const related = getRelatedTournaments(tournament, allTournaments);

  const statusEmoji: Record<string, string> = {
    open: "\u{1F7E2}",
    filling: "\u{1F7E1}",
    full: "\u{1F534}",
    closed: "\u26AB",
  };

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
    url: `https://pickleradar.app/tournaments/${tournament.id}`,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/50 via-white to-amber-50/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

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

        {/* Related tournaments */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-lg font-bold text-gray-800">
              More Upcoming Tournaments
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}`}
                  className="group block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-green-200"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      {formatDateRange(t.date_start, t.date_end)}
                    </span>
                    <span title={t.registration_status ?? "open"}>
                      {statusEmoji[t.registration_status ?? "open"] ?? "\u{1F7E2}"}
                    </span>
                  </div>
                  <h3 className="mb-1 text-lg font-bold text-gray-800 group-hover:text-green-700">
                    {t.name}
                  </h3>
                  <p className="mb-3 flex items-center gap-1.5 text-sm text-gray-500">
                    <span>{"\u{1F4CD}"}</span> {t.location_name}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {t.skill_levels?.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700"
                        >
                          {s}
                        </span>
                      ))}
                      {(t.skill_levels?.length ?? 0) > 4 && (
                        <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-400">
                          +{(t.skill_levels?.length ?? 0) - 4}
                        </span>
                      )}
                    </div>
                    {t.entry_fee != null && (
                      <span className="text-sm font-bold text-green-600">
                        {formatCurrency(t.entry_fee)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
        {/* Submit CTA */}
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

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-100 bg-white/60 py-8 text-center">
        <p className="text-sm text-gray-400">
          Made with {"\u{1F49A}"} for the Houston pickleball community
        </p>
      </footer>
    </div>
  );
}
