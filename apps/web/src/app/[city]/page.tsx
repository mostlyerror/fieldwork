import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCityBySlug, CITIES } from "@/lib/cities";
import { getTournamentsByCity } from "@/lib/queries";
import { getUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isTournamentPast } from "@/lib/format";
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
  // The query now includes a 30-day grace of recently-finished tournaments (for
  // results/findability). For counts and SEO "upcoming" structured data, use only
  // the genuinely-upcoming ones; the full list still flows to the Homepage so it
  // can render the separate "Recent results" section.
  const upcomingTournaments = tournaments.filter((t) => !isTournamentPast(t));

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
    numberOfItems: upcomingTournaments.length,
    itemListElement: upcomingTournaments.slice(0, 10).map((t, i) => ({
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

  const upcomingCount = upcomingTournaments.length;
  const venueCount = new Set(
    upcomingTournaments.map((t) => t.location_name),
  ).size;

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
            tournaments={upcomingTournaments}
            citySlug={city.slug}
          />
        }
        seoContent={
          <section className="border-t-2 border-gray-900">
            <div className="mx-auto max-w-6xl px-3 sm:px-5 py-16">
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                Why {city.name} Players Use PickleRadar
              </h2>

              {/* Feature cards */}
              <div className="mt-8 grid gap-6 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900">Every Tournament</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    We aggregate from PBBrackets, Pickleball Den, and community submissions.
                    {upcomingCount > 0 ? ` ${upcomingCount} upcoming across ${venueCount} venues.` : ""}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900">Real Rating Intel</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    Verified ratings, not the ones players list at signup. See who&apos;s really in
                    each bracket before you register. Sandbagger alerts included.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900">Never Miss a Match</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    Filter by skill level, view on a map, or subscribe to our weekly email digest
                    every Monday. New tournaments added daily.
                  </p>
                </div>
              </div>

              {/* Tournament list */}
              {upcomingCount > 0 && (
                <div className="mt-12">
                  <h3 className="text-lg font-extrabold text-gray-900">Upcoming in {city.name}</h3>
                  <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    {tournaments.slice(0, 8).map((t) => (
                      <a
                        key={t.id}
                        href={`/${city.slug}/tournaments/${t.id}`}
                        className="-mx-2 flex items-baseline justify-between gap-2 rounded border-b border-gray-100 px-2 py-2 text-sm hover:bg-gray-50"
                      >
                        <span className="font-semibold text-emerald-800">{t.name}</span>
                        <span className="shrink-0 text-gray-400">
                          {new Date(t.date_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        }
      />
    </>
  );
}
