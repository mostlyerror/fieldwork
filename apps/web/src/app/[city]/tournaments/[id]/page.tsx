import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTournament, getTournamentSources, getTournamentsByCity, getTournamentEvents, getTournamentMatches, getVenueTournaments } from "@/lib/queries";
import { getCityBySlug, getDefaultCity } from "@/lib/cities";
import { TournamentChrome, TournamentHero, TournamentOverview } from "@/components/tournament-detail";
import { EventBreakdown } from "@/components/event-breakdown";
import { LiveBracket } from "@/components/live-bracket";
import { TournamentPodium } from "@/components/tournament-podium";
import { Footer } from "@/components/footer";
import { FavoriteButton } from "@/components/favorite-button";
import { ReportIssue } from "@/components/report-issue";
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

  const isDraft = !tournament.status || tournament.status !== "active";
  const cityName = city?.name ?? getDefaultCity().name;
  const description = `${formatDateRange(tournament.date_start, tournament.date_end)} at ${tournament.location_name}. Find details and register for this ${cityName}-area pickleball tournament.`;

  const ogImageUrl = `https://pickleradar.app/api/og?id=${id}`;

  return {
    title: `${tournament.name} — PickleRadar`,
    description,
    ...(isDraft && { robots: { index: false, follow: false } }),
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

  const [tournament, sources, cityTournaments, events, matches] = await Promise.all([
    getTournament(id),
    getTournamentSources(id),
    getTournamentsByCity(citySlug),
    getTournamentEvents(id),
    getTournamentMatches(id),
  ]);

  if (!tournament) notFound();

  // Other tournaments at the same venue (the reciprocal of the venue page).
  // Only shown once a venue hosts more than this one; grows as data accrues.
  let venueMates: Tournament[] = [];
  if (tournament.venue_id) {
    const { upcoming, past } = await getVenueTournaments(tournament.venue_id);
    venueMates = [...upcoming, ...past].filter((t) => t.id !== tournament.id).slice(0, 6);
  }
  const venueMateIds = new Set(venueMates.map((t) => t.id));

  const related = getRelatedTournaments(tournament, cityTournaments).filter(
    (t) => !venueMateIds.has(t.id),
  );

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
    <div className="min-h-screen bg-background">
      {/* SportsEvent structured data is omitted for non-active (draft) rows so
          drafts emit no machine-readable listing — consistent with noindex. */}
      {tournament.status === "active" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ServerHeader city={city} />

      <main className="mx-auto max-w-4xl px-3 py-10 sm:px-5 lg:max-w-7xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            href={`/${citySlug}`}
            className="inline-flex items-center t-body text-gray-400 hover:text-emerald-700"
          >
            &larr; Back to tournaments
          </Link>
          <FavoriteButton
            compact
            item={{
              kind: "tournament",
              id,
              href: `/${citySlug}/tournaments/${id}`,
              title: tournament.name,
              subtitle: `${formatDateRange(tournament.date_start, tournament.date_end)}${tournament.location_name ? " · " + tournament.location_name : ""}`,
              meta: null,
            }}
          />
        </div>

        {/* Draft banner + on-scroll sticky action bar. The sticky bar is
            position:fixed so it spans the viewport regardless of this
            container; the draft banner renders here in normal flow (its
            original position, just after the back link). */}
        <TournamentChrome tournament={tournament} sources={sources} events={events} />

        {/* Briefing block. Mobile (< lg): plain stack — Hero, then the Overview
            card overlapping it, then Field Intelligence below (identical to
            before). Desktop (lg+): a two-column grid where the Overview becomes
            a sticky left rail spanning both rows, the Hero is the right-column
            banner, and Field Intelligence sits beneath the hero. DOM order stays
            Hero → Overview → Field-Intelligence so the mobile stack is unchanged;
            explicit grid placement reshuffles only on lg+. */}
        <div className="lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-x-8">
          <div className="lg:col-start-2 lg:row-start-1">
            <TournamentHero tournament={tournament} sources={sources} events={events} />
          </div>

          <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:self-start lg:sticky lg:top-6">
            <TournamentOverview
              tournament={tournament}
              sources={sources}
              events={events}
              citySlug={citySlug}
            />
          </div>

          {events.length > 0 && (
            <section
              id="field-intelligence"
              className="mt-6 scroll-mt-20 lg:col-start-2 lg:row-start-2 lg:mt-8"
            >
              <EventBreakdown events={events} />
            </section>
          )}
        </div>

        {/* Everything below the briefing block stays at the original reading
            width (max-w-4xl) and centered, identical on mobile and desktop —
            only the briefing block above goes wide on lg. */}
        <div className="lg:mx-auto lg:max-w-4xl">
        {matches.length > 0 && (
          <section className="mt-6">
            <LiveBracket matches={matches} events={events} />
          </section>
        )}

        {events.length > 0 && (
          <section className="mt-6">
            <TournamentPodium events={events} />
          </section>
        )}

        {/* Secondary "keep exploring" zone — deliberately quiet so it never
            competes with this tournament's field intelligence (the main event).
            Compact text links, not full cards. */}
        {(venueMates.length > 0 || related.length > 0) && (
          <div className="mt-14 space-y-8 border-t border-gray-200 pt-8">
            {venueMates.length > 0 && (
              <section>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <h2 className="t-caption font-bold uppercase tracking-widest text-gray-400">
                    More at {tournament.venue_name || tournament.location_name}
                  </h2>
                  {tournament.venue_slug && (
                    <Link
                      href={`/${citySlug}/venues/${tournament.venue_slug}`}
                      className="flex-shrink-0 t-caption text-emerald-700/80 hover:text-emerald-800"
                    >
                      View venue &rarr;
                    </Link>
                  )}
                </div>
                <div>
                  {venueMates.map((t) => (
                    <RelatedRow key={t.id} tournament={t} citySlug={citySlug} />
                  ))}
                </div>
              </section>
            )}

            {related.length > 0 && (
              <section>
                <h2 className="mb-1 t-caption font-bold uppercase tracking-widest text-gray-400">
                  More upcoming tournaments
                </h2>
                <div>
                  {related.map((t) => (
                    <RelatedRow key={t.id} tournament={t} citySlug={citySlug} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
        </div>
      </main>

      {/* Pre-footer CTA */}
      <div className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-6xl px-3 sm:px-5 py-10 text-center">
          <ReportIssue tournamentId={tournament.id} tournamentName={tournament.name} />
          <p className="mt-4 t-body text-gray-500">
            Know about another tournament?{" "}
            <Link href="/submit" className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2">
              Submit it
            </Link>
          </p>
        </div>
      </div>

      <Footer citySlug={citySlug} />
    </div>
  );
}

/** Quiet related-tournament link row — a deliberate downgrade from the full
 *  TournamentCard so the secondary zone never competes with this page's intel. */
function RelatedRow({
  tournament: t,
  citySlug,
}: {
  tournament: Tournament;
  citySlug: string;
}) {
  return (
    <Link
      href={`/${citySlug}/tournaments/${t.id}`}
      className="group flex items-center justify-between gap-4 border-b border-gray-100 py-2.5 last:border-0"
    >
      <span className="min-w-0">
        <span className="block truncate t-body font-semibold text-gray-700 transition-colors group-hover:text-emerald-700">
          {t.name}
        </span>
        <span className="block truncate t-caption text-gray-400">
          {t.location_name}
        </span>
      </span>
      <span className="flex-shrink-0 t-caption text-gray-400">
        {formatDateRange(t.date_start, t.date_end)}
      </span>
    </Link>
  );
}
