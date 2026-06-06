import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getPlayer,
  getPlayerMatches,
  getPlayerUpcomingTournaments,
  getPlayerPastTournaments,
  getPlayerRatingHistory,
  getOpponentRatings,
  computePlayerRecord,
  computeFrequentPartners,
  computeFrequentOpponents,
} from "@/lib/queries";
import { deriveMatchSignals, computeBadges } from "@/lib/badges";
import { BadgeShelf } from "@/components/player/badge-shelf";
import { IntelSectionHeader } from "@/components/intel-section-header";
import { PlayerRatingChart } from "@/components/player-rating-chart";
import { IdentityBand } from "@/components/player/identity-band";
import { TheRead } from "@/components/player/the-read";
import { RecordModule } from "@/components/player/record-module";
import { PartnerChemistry } from "@/components/player/partner-chemistry";
import { HeadToHead } from "@/components/player/head-to-head";
import { RecentMatches } from "@/components/player/recent-matches";
import { buildPlayerRead } from "@/lib/player-read";
import {
  toPlayerReadInput,
  deriveTrendLabel,
  buildPartnerRows,
  buildOpponentRows,
} from "@/lib/player-read-input";
import { BackButton } from "@/components/back-button";
import { ServerHeader } from "@/components/server-header";
import { getDefaultCity } from "@/lib/cities";

export const revalidate = 600;

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) return { title: "Player Not Found" };

  const ratingStr = player.dupr_doubles != null ? ` — ${player.dupr_doubles.toFixed(2)}` : "";
  return {
    title: `${player.name}${ratingStr} — PickleRadar`,
    description: `View ${player.name}'s pickleball match history, W-L record, and rating on PickleRadar.`,
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const isDoublesFormat = (fmt: string) => /doubles/i.test(fmt);
const isSinglesFormat = (fmt: string) => /singles/i.test(fmt);

export default async function PlayerPage({ params }: PageProps) {
  const { id } = await params;
  const [player, matches, upcoming, pastTournaments, ratingHistory] = await Promise.all([
    getPlayer(id),
    // Lifetime matches so Record / Partner Chemistry / the READ's format splits
    // are career figures. Form (last ~10) and the recent-matches list slice from
    // the front of this set, so they stay "recent".
    getPlayerMatches(id, 300),
    getPlayerUpcomingTournaments(id),
    getPlayerPastTournaments(id),
    getPlayerRatingHistory(id),
  ]);

  if (!player) notFound();

  const city = getDefaultCity();
  const records = computePlayerRecord(matches, id);
  const partners = computeFrequentPartners(matches, id);

  // Scouting read — the deterministic copy engine. ratingHistory is {date,rating};
  // the adapter expects {event_date,rating}, so remap before feeding it in.
  const readInput = toPlayerReadInput({
    player,
    matches,
    ratingHistory: ratingHistory.map((p) => ({ event_date: p.date, rating: p.rating })),
    partners,
    records,
    playerId: id,
  });
  const read = buildPlayerRead(readInput);

  // Record splits for the RecordModule (overall = sum of format splits).
  const doublesRecord = records
    .filter((r) => isDoublesFormat(r.format))
    .reduce((acc, r) => ({ wins: acc.wins + r.wins, losses: acc.losses + r.losses }), { wins: 0, losses: 0 });
  const singlesRecord = records
    .filter((r) => isSinglesFormat(r.format))
    .reduce((acc, r) => ({ wins: acc.wins + r.wins, losses: acc.losses + r.losses }), { wins: 0, losses: 0 });
  const overallRecord = records.reduce(
    (acc, r) => ({ wins: acc.wins + r.wins, losses: acc.losses + r.losses }),
    { wins: 0, losses: 0 },
  );

  const partnerRows = buildPartnerRows(partners);
  const opponentRows = buildOpponentRows(computeFrequentOpponents(matches, id));

  // Badges — same fits/facts that power The Read, plus a pass over raw game
  // scores (Pickle / Comeback / Clutch) and opponent ratings (Giant Slayer).
  const playerRating = player.dupr_doubles ?? player.dupr_singles;
  const opponentRatings = await getOpponentRatings(matches, id);
  const signals = deriveMatchSignals(matches, id, opponentRatings, playerRating);
  const atPeak =
    ratingHistory.length >= 5 &&
    ratingHistory[ratingHistory.length - 1].rating >=
      Math.max(...ratingHistory.map((p) => p.rating)) - 0.001;
  const badges = computeBadges({ fits: read.fits, facts: read.facts, signals, atPeak });

  const hasMatches = matches.length > 0;
  // Consent floor: the interpretive scouting paragraph ("The Read") is gated
  // behind a claimed profile. We won't publish an editorial read on a player who
  // never opted in; factual data (ratings, record, matches) stays public.
  const isClaimed = player.user_id != null;
  const showChart = ratingHistory.length >= 2;
  const ratingDelta = showChart
    ? ratingHistory[ratingHistory.length - 1].rating -
      ratingHistory[Math.max(0, ratingHistory.length - 1 - 10)].rating
    : null;

  return (
    <div className="min-h-screen bg-background">
      <ServerHeader city={city} />

      <main className="mx-auto max-w-3xl px-3 sm:px-5 py-8 lg:max-w-6xl">
        {/* Back link — uses browser history so it returns to the referring page
             (e.g. a specific tournament) instead of always going to the list */}
        <BackButton
          fallbackHref={`/${city.slug}`}
          label="Back"
          className="mb-6 inline-flex min-h-[44px] items-center py-2 t-body text-gray-400 hover:text-emerald-700"
        />

        {/* Desktop: sticky identity rail + activity column. Mobile: a single
            stack in the original order (identity first, then everything in
            sequence) — the grid only engages at lg, so mobile is unchanged. */}
        <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* Left rail — who this player is (sticky on desktop) */}
          <div className="lg:sticky lg:top-6">
            <IdentityBand
              name={player.name}
              location={player.location}
              duprDoubles={player.dupr_doubles}
              duprSingles={player.dupr_singles}
              doublesVerified={player.dupr_verified === true}
              singlesVerified={player.dupr_singles_verified === true}
              formLabel={read.formLabel}
              lastUpdated={player.dupr_last_checked}
            />
          </div>

          {/* Right column — the activity. space-y keeps uniform gaps; mt-6 sets
              the mobile gap under the rail, removed once the grid takes over. */}
          <div className="mt-6 space-y-6 lg:mt-0">
            {/* The Read — interpretive scouting paragraph. Consent floor: only
                shown on claimed profiles; hidden for unclaimed players. */}
            {isClaimed && hasMatches && <TheRead read={read.read} />}

            {/* Badges — earned scouting tells, rarity-tinted */}
            {badges.length > 0 && <BadgeShelf badges={badges} />}

            {/* Record — overall + doubles + singles splits */}
            {hasMatches && (
              <RecordModule overall={overallRecord} doubles={doublesRecord} singles={singlesRecord} />
            )}

            {/* Doubles rating trend (with tournament markers) */}
            {showChart && (
              <PlayerRatingChart
                points={ratingHistory}
                current={ratingHistory[ratingHistory.length - 1].rating}
                delta={ratingDelta}
                peak={Math.max(...ratingHistory.map((p) => p.rating))}
                low={Math.min(...ratingHistory.map((p) => p.rating))}
                trendLabel={deriveTrendLabel(ratingDelta)}
                events={pastTournaments.map((t) => ({ date: t.date, label: t.name }))}
              />
            )}

            {/* Partner Chemistry + Head-to-Head — side by side on desktop */}
            {(partnerRows.length > 0 || opponentRows.length > 0) && (
              <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                {partnerRows.length > 0 && <PartnerChemistry partners={partnerRows} />}
                {opponentRows.length > 0 && <HeadToHead opponents={opponentRows} />}
              </div>
            )}

            {/* Recent Matches */}
            {hasMatches && (
              <RecentMatches matches={matches} playerId={id} totalCount={matches.length} />
            )}

            {/* Upcoming Tournaments */}
            {upcoming.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-gray-200/70 shadow-card sm:rounded-3xl">
                <IntelSectionHeader title="Upcoming Tournaments" />
                <div className="divide-y divide-gray-50 bg-white">
                  {upcoming.map((t, i) => (
                    <Link
                      key={`${t.tournamentId}-${t.eventName}-${i}`}
                      href={`/${city.slug}/tournaments/${t.tournamentId}`}
                      className="flex items-start justify-between gap-4 px-4 py-3 transition hover:bg-gray-50"
                    >
                      <div className="min-w-0">
                        <p className="t-body font-semibold text-gray-900 truncate">
                          {t.tournamentName}
                        </p>
                        <p className="t-caption text-gray-500 truncate">{t.eventName}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="t-caption text-gray-400">{formatDate(t.dateStart)}</p>
                        {t.listedDupr != null && (
                          <p className="t-caption text-emerald-600 mt-0.5">
                            Listed {t.listedDupr.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {!hasMatches && upcoming.length === 0 && (
              <div className="rounded-2xl border border-gray-200/70 bg-white p-8 text-center shadow-card sm:rounded-3xl">
                <p className="text-gray-400">No match history or upcoming tournaments available yet</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
