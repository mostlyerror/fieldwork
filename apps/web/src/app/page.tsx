import type { Metadata } from "next";
import { getTournaments } from "@/lib/queries";
import { Homepage } from "@/components/homepage";

export const revalidate = 300; // ISR: 5 minutes

export const metadata: Metadata = {
  title: "PickleRadar — Houston Pickleball Tournaments",
  description:
    "Find every upcoming pickleball tournament in the Houston area. Search by name, venue, or skill level. Houston pickleball events, brackets, and registration links — all in one place.",
  openGraph: {
    title: "PickleRadar — Houston Pickleball Tournaments",
    description:
      "Every upcoming Houston-area pickleball tournament, one search away. Browse events, check skill levels, and register.",
    type: "website",
    url: "https://pickleradar.app",
    siteName: "PickleRadar",
  },
  twitter: {
    card: "summary_large_image",
    title: "PickleRadar — Houston Pickleball Tournaments",
    description:
      "Every upcoming Houston-area pickleball tournament, one search away.",
  },
};

export default async function Home() {
  let tournaments: Awaited<ReturnType<typeof getTournaments>>;
  try {
    tournaments = await getTournaments();
  } catch {
    tournaments = [];
  }

  const jsonLdWebSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PickleRadar",
    url: "https://pickleradar.app",
    description:
      "Find every upcoming pickleball tournament in the Houston area.",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://pickleradar.app/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  const jsonLdItemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Upcoming Houston Pickleball Tournaments",
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
        url: `https://pickleradar.app/tournaments/${t.id}`,
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
      <Homepage tournaments={tournaments} />
    </>
  );
}
