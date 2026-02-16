import { getUser, getUserProfile } from "@/lib/auth";
import { getTournamentEvents } from "@/lib/queries";
import { RecommendedTournaments } from "./recommended-tournaments";
import type { Tournament, TournamentEvent } from "@/lib/types";

export async function RecommendedTournamentsWrapper({
  tournaments,
  citySlug,
}: {
  tournaments: Tournament[];
  citySlug: string;
}) {
  const user = await getUser();
  if (!user) return null;

  const profile = await getUserProfile();
  if (!profile) return null;

  const hasDupr =
    profile.dupr_rating_doubles != null || profile.dupr_rating_singles != null;
  if (!hasDupr) return null;

  // Fetch events for tournaments that have intelligence data
  const tournamentsWithEvents = tournaments.filter(
    (t) => t.event_count && t.event_count > 0,
  );

  const eventsMap = new Map<string, TournamentEvent[]>();
  await Promise.all(
    tournamentsWithEvents.map(async (t) => {
      const events = await getTournamentEvents(t.id);
      if (events.length > 0) {
        eventsMap.set(t.id, events);
      }
    }),
  );

  return (
    <RecommendedTournaments
      tournaments={tournaments}
      user={{
        dupr_rating_doubles: profile.dupr_rating_doubles,
        dupr_rating_singles: profile.dupr_rating_singles,
        location_latitude: profile.location_latitude,
        location_longitude: profile.location_longitude,
      }}
      events={eventsMap}
      citySlug={citySlug}
    />
  );
}
