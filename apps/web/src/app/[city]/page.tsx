import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCityBySlug, CITIES } from "@/lib/cities";
import { getTournamentsByCity } from "@/lib/queries";
import { getUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { Homepage } from "@/components/homepage";
import { RecommendedTournamentsWrapper } from "@/components/recommended-tournaments-wrapper";

export const revalidate = 300;

type PageProps = { params: Promise<{ city: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const city = getCityBySlug(slug);
  if (!city) return { title: "City Not Found — PickleRadar" };

  const title = `PickleRadar — ${city.name} Pickleball Tournaments`;
  const description = `Find every upcoming pickleball tournament in the ${city.name} area. Search by name, venue, or skill level. ${city.name} pickleball events, brackets, and registration links — all in one place.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description: `Every upcoming ${city.name}-area pickleball tournament, one search away. Browse events, check skill levels, and register.`,
      type: "website",
      url: `https://pickleradar.app/${city.slug}`,
      siteName: "PickleRadar",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: `Every upcoming ${city.name}-area pickleball tournament, one search away.`,
    },
  };
}

export function generateStaticParams() {
  return Object.keys(CITIES).map((slug) => ({ city: slug }));
}

export default async function CityPage({ params }: PageProps) {
  const { city: slug } = await params;
  const city = getCityBySlug(slug);
  if (!city) notFound();

  const supabase = getSupabaseAdmin();
  const [tournamentsResult, user, subscriberResult] = await Promise.all([
    getTournamentsByCity(city.slug).catch(() => []),
    getUser().catch(() => null),
    supabase
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .then((r: { count: number | null }) => r.count ?? 0),
  ]);
  const tournaments = tournamentsResult;

  const jsonLdWebSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PickleRadar",
    url: "https://pickleradar.app",
    description: `Find every upcoming pickleball tournament in the ${city.name} area.`,
    potentialAction: {
      "@type": "SearchAction",
      target: `https://pickleradar.app/${city.slug}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const jsonLdItemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Upcoming ${city.name} Pickleball Tournaments`,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: tournaments.length,
    itemListElement: tournaments.slice(0, 10).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "SportsEvent",
        name: t.name,
        startDate: t.date_start,
        ...(t.date_end && { endDate: t.date_end }),
        location: {
          "@type": "Place",
          name: t.location_name,
          ...(t.location_address && { address: t.location_address }),
        },
        sport: "Pickleball",
        url: `https://pickleradar.app/${city.slug}/tournaments/${t.id}`,
      },
    })),
  };

  const upcomingCount = tournaments.length;
  const nextTournament = tournaments[0];
  const venueCount = new Set(tournaments.map((t) => t.location_name)).size;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebSite) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdItemList) }}
      />
      <Homepage
        tournaments={tournaments}
        city={city}
        user={user}
        subscriberCount={subscriberResult}
        tournamentCount={upcomingCount}
        recommendations={
          <RecommendedTournamentsWrapper
            tournaments={tournaments}
            citySlug={city.slug}
          />
        }
      />
      {/* Server-rendered SEO content — crawlable text that client components can't provide */}
      <section className="mx-auto max-w-4xl px-5 py-16">
        <h2 className="text-2xl font-extrabold text-gray-900">
          {city.name} Pickleball Tournaments
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          PickleRadar tracks every upcoming pickleball tournament in the {city.name} area.
          {upcomingCount > 0
            ? ` There are currently ${upcomingCount} upcoming tournaments across ${venueCount} venues.`
            : ""}{" "}
          {nextTournament
            ? `The next event is ${nextTournament.name} at ${nextTournament.location_name} on ${new Date(nextTournament.date_start + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`
            : ""}{" "}
          We aggregate listings from PickleballBrackets, Pickleball Den, and community submissions so you
          only need to check one place.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          Filter by skill level, sort by distance, and view tournaments on a map. Every listing links
          directly to the registration page. New tournaments are added daily, and our weekly email digest
          keeps you up to date every Monday.
        </p>
        {upcomingCount > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-bold text-gray-800">Upcoming Tournaments</h3>
            <ul className="mt-2 space-y-1">
              {tournaments.slice(0, 8).map((t) => (
                <li key={t.id} className="text-sm text-gray-500">
                  <a
                    href={`/${city.slug}/tournaments/${t.id}`}
                    className="font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    {t.name}
                  </a>{" "}
                  — {new Date(t.date_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {t.location_name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
