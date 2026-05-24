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
        recommendations={
          <RecommendedTournamentsWrapper
            tournaments={tournaments}
            citySlug={city.slug}
          />
        }
      />
    </>
  );
}
