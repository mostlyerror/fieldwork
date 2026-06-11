import { supabase } from "./supabase.js";
import { localDateString } from "./local-date.js";

const PBB_API = "https://pickleballtournaments.com/tournaments/api";

interface PbbMatch {
  matchUuid: string;
  teamOnePlayerOneName: string;
  teamOnePlayerTwoName: string | null;
  teamTwoPlayerOneName: string;
  teamTwoPlayerTwoName: string | null;
  teamOnePlayerOneUuid: string;
  teamOnePlayerTwoUuid: string | null;
  teamTwoPlayerOneUuid: string;
  teamTwoPlayerTwoUuid: string | null;
  teamOneRating: number;
  teamTwoRating: number;
  teamOneSeed: number;
  teamTwoSeed: number;
  teamOneGameOneScore: number;
  teamOneGameTwoScore: number;
  teamOneGameThreeScore: number;
  teamOneGameFourScore: number;
  teamOneGameFiveScore: number;
  teamTwoGameOneScore: number;
  teamTwoGameTwoScore: number;
  teamTwoGameThreeScore: number;
  teamTwoGameFourScore: number;
  teamTwoGameFiveScore: number;
  winner: number;
  matchStatus: number;
  roundNumber: number;
  matchNumber: number;
  roundText: string;
  inBracketType: string;
  poolId: string | null;
  courtTitle: string;
  matchPlannedStart: string | null;
  matchStart: string | null;
  matchCompleted: string | null;
}

interface PbbEvent {
  activityId: string;
  eventId: string;
  title: string;
  status: { text: string; id: number };
  showDraws: boolean;
  goldMedalTeam: string;
  silverMedalTeam: string;
  bronzeMedalTeam: string;
}

interface PbbTourneyEventsResponse {
  events: { groupTitle: string; events: PbbEvent[] }[];
  tourneyId: string;
}

export interface LiveMatchResult {
  tournamentsChecked: number;
  eventsChecked: number;
  matchesUpserted: number;
}

// Venue-local "today" — NOT UTC. The nightly scrape runs ~9–10 PM Central,
// which is already tomorrow in UTC; a one-day tournament's evening matches
// (finals!) were being filtered out as "ended yesterday" and queried with the
// wrong date param. (PBB's getMatchInfos date is the venue-local match date.)
function todayString(): string {
  return localDateString();
}

function packScores(m: PbbMatch, team: "One" | "Two"): number[] {
  const scores: number[] = [];
  for (const game of ["One", "Two", "Three", "Four", "Five"] as const) {
    const key = `team${team}Game${game}Score` as keyof PbbMatch;
    const val = m[key] as number;
    if (val > 0 || scores.length > 0) scores.push(val);
  }
  return scores;
}

async function getActiveTournaments(): Promise<{ id: string; slug: string; name: string }[]> {
  const today = todayString();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, source_url, name")
    .eq("status", "active")
    .lte("date_start", today)
    .gte("date_end", today);

  if (error || !data) {
    console.error("[live-matches] Error fetching active tournaments:", error);
    return [];
  }

  return data.map((t) => {
    const url = t.source_url as string;
    const slug = url.split("/tournaments/")[1]?.replace(/\/.*$/, "") ?? "";
    return { id: t.id as string, slug, name: t.name as string };
  });
}

async function fetchTourneyEvents(slug: string): Promise<PbbEvent[]> {
  const res = await fetch(`${PBB_API}/tourneyEvents?slug=${slug}`);
  if (!res.ok) return [];

  const body = (await res.json()) as PbbTourneyEventsResponse;
  const events: PbbEvent[] = [];
  for (const group of body.events ?? []) {
    for (const event of group.events ?? []) {
      events.push(event);
    }
  }
  return events;
}

async function fetchMatchInfos(eventId: string, date: string): Promise<PbbMatch[]> {
  const res = await fetch(`${PBB_API}/getMatchInfos?eventId=${eventId}&date=${date}`);
  if (!res.ok) return [];

  const body = await res.json();
  return (body.data ?? []) as PbbMatch[];
}

function resolveEventId(
  activityId: string,
  eventMap: Map<string, string>,
): string | null {
  return eventMap.get(activityId.toLowerCase()) ?? null;
}

export async function fetchLiveMatches(): Promise<LiveMatchResult> {
  const result: LiveMatchResult = { tournamentsChecked: 0, eventsChecked: 0, matchesUpserted: 0 };
  const tournaments = await getActiveTournaments();
  const today = todayString();

  console.log(`[live-matches] Found ${tournaments.length} active tournament(s) today`);

  for (const tournament of tournaments) {
    if (!tournament.slug) continue;
    result.tournamentsChecked++;
    console.log(`[live-matches] Checking: ${tournament.name}`);

    const pbbEvents = await fetchTourneyEvents(tournament.slug);
    if (pbbEvents.length === 0) continue;

    // Build map of activityId → our event_id
    const { data: ourEvents } = await supabase
      .from("tournament_events")
      .select("id, source_event_id")
      .eq("tournament_id", tournament.id);

    const eventMap = new Map<string, string>();
    for (const e of ourEvents ?? []) {
      if (e.source_event_id) {
        eventMap.set((e.source_event_id as string).toLowerCase(), e.id as string);
      }
    }

    for (const pbbEvent of pbbEvents) {
      if (!pbbEvent.showDraws) continue;

      result.eventsChecked++;
      const matches = await fetchMatchInfos(pbbEvent.activityId, today);
      if (matches.length === 0) continue;

      const eventId = resolveEventId(pbbEvent.activityId, eventMap);

      const rows = matches.map((m) => ({
        match_uuid: m.matchUuid,
        tournament_id: tournament.id,
        event_id: eventId,
        team1_player1_name: m.teamOnePlayerOneName?.trim() || null,
        team1_player2_name: m.teamOnePlayerTwoName?.trim() || null,
        team2_player1_name: m.teamTwoPlayerOneName?.trim() || null,
        team2_player2_name: m.teamTwoPlayerTwoName?.trim() || null,
        team1_player1_uuid: m.teamOnePlayerOneUuid || null,
        team1_player2_uuid: m.teamOnePlayerTwoUuid || null,
        team2_player1_uuid: m.teamTwoPlayerOneUuid || null,
        team2_player2_uuid: m.teamTwoPlayerTwoUuid || null,
        team1_rating: m.teamOneRating,
        team2_rating: m.teamTwoRating,
        team1_seed: m.teamOneSeed,
        team2_seed: m.teamTwoSeed,
        team1_scores: packScores(m, "One"),
        team2_scores: packScores(m, "Two"),
        winner: m.winner,
        match_status: m.matchStatus,
        round_number: m.roundNumber,
        match_number: m.matchNumber,
        round_text: m.roundText || null,
        bracket_type: m.inBracketType || null,
        pool_id: m.poolId || null,
        court_title: m.courtTitle || null,
        planned_start: m.matchPlannedStart,
        match_start: m.matchStart,
        match_completed: m.matchCompleted,
        updated_at: new Date().toISOString(),
      }));

      const { error, count } = await supabase
        .from("tournament_matches")
        .upsert(rows, { onConflict: "match_uuid", count: "exact" });

      if (error) {
        console.error(`[live-matches] Upsert error for event ${pbbEvent.title}:`, error);
      } else {
        result.matchesUpserted += count ?? rows.length;
        console.log(`[live-matches] ${pbbEvent.title}: ${rows.length} matches`);
      }
    }
  }

  return result;
}
