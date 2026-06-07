import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { getVenueBySlug, getVenueTournaments } from "@/lib/queries";
import { getCityBySlug } from "@/lib/cities";
import { TournamentCard } from "@/components/tournament-card";
import { FavoriteButton } from "@/components/favorite-button";
import { ServerHeader } from "@/components/server-header";
import { Footer } from "@/components/footer";
import { BackLink } from "@/components/back-link";

const MiniMap = dynamic(() => import("@/components/mini-map"));

export const revalidate = 600;

type PageProps = { params: Promise<{ city: string; slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug, slug } = await params;
  const venue = await getVenueBySlug(slug);
  if (!venue) return { title: "Venue Not Found — PickleRadar" };
  const city = getCityBySlug(citySlug);
  const cityName = city?.name ?? "Houston";
  const title = `${venue.name} Pickleball Tournaments — PickleRadar`;
  const description = `Every pickleball tournament at ${venue.name} in ${cityName}. Upcoming events, past results, and registration links.`;
  const url = `https://pickleradar.app/${citySlug}/venues/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "website", url, siteName: "PickleRadar" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export async function generateStaticParams() {
  try {
    const { getVenuesForSitemap } = await import("@/lib/queries");
    const venues = await getVenuesForSitemap();
    return venues
      .filter((v) => v.city_slug)
      .map((v) => ({ city: v.city_slug as string, slug: v.slug }));
  } catch {
    return [];
  }
}

export default async function VenuePage({ params }: PageProps) {
  const { city: citySlug, slug } = await params;
  const city = getCityBySlug(citySlug);
  if (!city) notFound();
  const venue = await getVenueBySlug(slug);
  if (!venue) notFound();

  const { upcoming, past } = await getVenueTournaments(venue.id);

  const firstDate = [...upcoming, ...past]
    .map((t) => t.date_start)
    .sort()[0];
  const cadence =
    upcoming.length + past.length > 0
      ? `Hosted ${upcoming.length + past.length} tournament${upcoming.length + past.length === 1 ? "" : "s"}${firstDate ? ` since ${new Date(firstDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : ""}.${upcoming[0] ? ` Next on ${new Date(upcoming[0].date_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}.` : ""}`
      : "No tournaments on record yet.";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: venue.name,
    ...(venue.formatted_address && { address: venue.formatted_address }),
    ...(venue.latitude != null && venue.longitude != null && {
      geo: { "@type": "GeoCoordinates", latitude: venue.latitude, longitude: venue.longitude },
    }),
    url: `https://pickleradar.app/${citySlug}/venues/${slug}`,
    event: upcoming.slice(0, 10).map((t) => ({
      "@type": "SportsEvent",
      name: t.name,
      startDate: t.date_start,
      ...(t.date_end && { endDate: t.date_end }),
      sport: "Pickleball",
      url: `https://pickleradar.app/${citySlug}/tournaments/${t.id}`,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ServerHeader city={city} />
      <main className="mx-auto max-w-6xl px-3 sm:px-5 py-10">
        <BackLink
          fallbackHref={`/${citySlug}`}
          fallbackLabel={`Back to ${city.name}`}
          className="mb-8 inline-flex items-center t-body text-gray-400 hover:text-emerald-700"
        />
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="t-h1 text-gray-900">{venue.name}</h1>
            {venue.formatted_address && <p className="mt-1 text-gray-500">{venue.formatted_address}</p>}
            <p className="mt-2 t-body text-gray-600">{cadence}</p>
          </div>
          <FavoriteButton
            compact
            item={{
              kind: "venue",
              id: slug,
              href: `/${citySlug}/venues/${slug}`,
              title: venue.name,
              subtitle: venue.formatted_address ?? null,
              meta: null,
            }}
          />
        </header>

        {venue.latitude != null && venue.longitude != null && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200/70 shadow-card">
            <MiniMap latitude={venue.latitude} longitude={venue.longitude} />
          </div>
        )}

        {upcoming.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 t-h2 font-bold text-gray-800">Upcoming at {venue.name}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((t) => <TournamentCard key={t.id} tournament={t} citySlug={citySlug} />)}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="mb-4 t-h2 font-bold text-gray-800">Past Tournaments</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((t) => <TournamentCard key={t.id} tournament={t} citySlug={citySlug} />)}
            </div>
          </section>
        )}
      </main>
      <Footer citySlug={citySlug} />
    </div>
  );
}
