import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getVenuesWithStats } from "@/lib/queries";
import { getCityBySlug } from "@/lib/cities";
import { VenueCard } from "@/components/venue-card";
import { ServerHeader } from "@/components/server-header";
import { Footer } from "@/components/footer";

export const revalidate = 600;

type PageProps = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug } = await params;
  const city = getCityBySlug(citySlug);
  const cityName = city?.name ?? "Houston";
  const title = `Pickleball Venues in ${cityName} — PickleRadar`;
  const description = `Every venue hosting pickleball tournaments in ${cityName}: photos, upcoming events, and tournament history.`;
  const url = `https://pickleradar.app/${citySlug}/venues`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "website", url, siteName: "PickleRadar" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function VenuesIndexPage({ params }: PageProps) {
  const { city: citySlug } = await params;
  const city = getCityBySlug(citySlug);
  if (!city) notFound();

  const venues = await getVenuesWithStats(citySlug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Pickleball venues in ${city.name}`,
    itemListElement: venues.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: v.name,
      url: `https://pickleradar.app/${citySlug}/venues/${v.slug}`,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ServerHeader city={city} />
      <main className="mx-auto max-w-6xl px-3 sm:px-5 py-10">
        <header className="mb-6">
          <p className="t-label mb-2 text-emerald-700">{city.name}</p>
          <h1 className="t-h1 text-gray-900">Pickleball venues</h1>
          <p className="mt-2 t-body text-gray-500">
            {venues.length > 0
              ? `${venues.length} venue${venues.length === 1 ? "" : "s"} hosting tournaments across greater ${city.name}.`
              : "No venues on record yet."}
          </p>
        </header>
        {venues.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((v) => (
              <VenueCard key={v.id} venue={v} citySlug={citySlug} />
            ))}
          </div>
        )}
      </main>
      <Footer citySlug={citySlug} />
    </div>
  );
}
