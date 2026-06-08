import { supabase } from "./supabase";
import type { Tournament, TournamentSource, TournamentEvent, TournamentMatch, EventPlayer, Player, Match, PlayerRecord, FrequentPartner, FrequentOpponent, ResultCardData, Venue } from "./types";
import { getCityBySlug, getDefaultCity } from "./cities";
import { cleanEventName } from "./event-name";

/** Tidy an event name from a raw query row carrying name + skill bounds. */
function cleanRowEventName(event: Record<string, unknown>): string {
  return cleanEventName({
    name: event.name as string,
    skill_level_min: (event.skill_level_min as number | null) ?? null,
    skill_level_max: (event.skill_level_max as number | null) ?? null,
  });
}

export async function getTournaments(): Promise<Tournament[]> {
  // 30-day discovery grace: recently-ended tournaments stay findable for results.
  // Mirrors the tournaments_near RPC (the city/search surface).
  const cutoff = new Date(Date.now() - 30 * 86_400_000)
    .toISOString()
    .split("T")[0];
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("status", "active")
    .gte("date_end", cutoff)
    .order("date_start", { ascending: true });

  if (error) {
    console.error("Error fetching tournaments:", error);
    return [];
  }

  const tournaments = (data ?? []) as Tournament[];
  return attachIntelligenceAggregates(tournaments);
}

export async function getTournamentsByCity(
  citySlug: string,
): Promise<Tournament[]> {
  const city = getCityBySlug(citySlug) ?? getDefaultCity();
  const { data, error } = await supabase.rpc("tournaments_near", {
    center_lat: city.latitude,
    center_lng: city.longitude,
    radius_miles: city.radiusMiles,
  });

  if (error) {
    console.error("Error fetching tournaments by city:", error);
    return [];
  }

  const tournaments = ((data as Tournament[]) ?? []);
  return attachIntelligenceAggregates(tournaments);
}

export async function getTournament(
  id: string
): Promise<Tournament | null> {
  // Join the venue slug so the detail page can link the venue name. Falls back
  // to a plain select if the venues relationship doesn't exist yet (pre-024).
  let { data, error } = await supabase
    .from("tournaments")
    .select("*, venues(slug, name)")
    .eq("id", id)
    .single();

  if (error) {
    ({ data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", id)
      .single());
  }

  if (error || !data) {
    if (error) console.error("Error fetching tournament:", error);
    return null;
  }

  const row = data as Tournament & {
    venues?: { slug: string; name: string } | null;
  };
  const tournament: Tournament = {
    ...row,
    venue_slug: row.venues?.slug ?? null,
    venue_name: row.venues?.name ?? null,
  };

  // Attach intelligence aggregates for single tournament
  const [withAggregates] = await attachIntelligenceAggregates([tournament]);
  return withAggregates ?? tournament;
}

export async function getTournamentSources(
  tournamentId: string
): Promise<TournamentSource[]> {
  const { data, error } = await supabase
    .from("tournament_sources")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching tournament sources:", error);
    return [];
  }
  return data ?? [];
}

export async function getTournamentMatches(
  tournamentId: string
): Promise<TournamentMatch[]> {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("round_number", { ascending: true })
    .order("match_number", { ascending: true });

  if (error) {
    console.error("Error fetching tournament matches:", error);
    return [];
  }
  return (data ?? []) as TournamentMatch[];
}

export async function getResultCardData(
  eventId: string,
  playerId: string,
): Promise<ResultCardData | null> {
  const { data: ep, error } = await supabase
    .from("event_players")
    .select("player_name, partner_name, placement, enriched_dupr, partner_enriched_dupr, dupr_rating, partner_dupr_rating, event_id, player_id")
    .eq("event_id", eventId)
    .eq("player_id", playerId)
    .not("placement", "is", null)
    .maybeSingle();

  if (error || !ep || !ep.placement) return null;

  const { data: event } = await supabase
    .from("tournament_events")
    .select("name, tournament_id, skill_level_min, skill_level_max")
    .eq("id", eventId)
    .single();

  if (!event) return null;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name, date_start, date_end, location_name")
    .eq("id", event.tournament_id)
    .single();

  if (!tournament) return null;

  const { data: medalists } = await supabase
    .from("event_players")
    .select("player_name, partner_name, placement")
    .eq("event_id", eventId)
    .not("placement", "is", null)
    .order("placement", { ascending: true });

  function teamName(row: { player_name: string; partner_name: string | null }): string {
    return [row.player_name, row.partner_name].filter(Boolean).join(" & ");
  }

  const gold = medalists?.find((m) => m.placement === 1);
  const silver = medalists?.find((m) => m.placement === 2);
  const bronze = medalists?.find((m) => m.placement === 3);

  const dateStr = tournament.date_start === tournament.date_end
    ? new Date(tournament.date_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : `${new Date(tournament.date_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${new Date(tournament.date_end + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return {
    playerName: ep.player_name as string,
    partnerName: ep.partner_name as string | null,
    placement: ep.placement as number,
    dupr: (ep.enriched_dupr as number | null) ?? (ep.dupr_rating as number | null),
    partnerDupr: (ep.partner_enriched_dupr as number | null) ?? (ep.partner_dupr_rating as number | null),
    eventName: cleanRowEventName(event),
    eventId,
    tournamentName: tournament.name as string,
    tournamentDate: dateStr,
    venue: tournament.location_name as string,
    playerId,
    goldTeam: gold ? teamName(gold as { player_name: string; partner_name: string | null }) : null,
    silverTeam: silver ? teamName(silver as { player_name: string; partner_name: string | null }) : null,
    bronzeTeam: bronze ? teamName(bronze as { player_name: string; partner_name: string | null }) : null,
  };
}

export async function getTournamentEvents(
  tournamentId: string
): Promise<TournamentEvent[]> {
  const { data: events, error } = await supabase
    .from("tournament_events")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching tournament events:", error);
    return [];
  }

  if (!events || events.length === 0) return [];

  // Fetch players for all events, joining live DUPR from the players table
  const eventIds = events.map((e: TournamentEvent) => e.id);
  const { data: players, error: playersError } = await supabase
    .from("event_players")
    .select("*, players!event_players_player_id_fkey(dupr_doubles, dupr_verified, dupr_singles, dupr_singles_verified), partner:players!event_players_partner_id_fkey(dupr_doubles, dupr_verified, dupr_singles, dupr_singles_verified)")
    .in("event_id", eventIds)
    .order("dupr_rating", { ascending: false, nullsFirst: false });

  if (playersError) {
    console.error("Error fetching event players:", playersError);
  }

  // A singles bracket must show the singles rating, not doubles. Map each
  // event to its format so the live-rating fallback picks the right field.
  const eventTypeById = new Map<string, string | null>(
    events.map((e: TournamentEvent & { event_type?: string | null }) => [e.id, e.event_type ?? null]),
  );

  type JoinedRatings = {
    dupr_doubles: number | null;
    dupr_verified: boolean | null;
    dupr_singles: number | null;
    dupr_singles_verified: boolean | null;
  } | null;

  // Group players by event, flattening the joined player data
  const playersByEvent = new Map<string, EventPlayer[]>();
  for (const raw of (players ?? [])) {
    const eventId = (raw as Record<string, unknown>).event_id as string;
    const isSingles = eventTypeById.get(eventId) === "singles";
    const joined = (raw as Record<string, unknown>).players as JoinedRatings;
    const partnerJoined = (raw as Record<string, unknown>).partner as JoinedRatings;
    // Format-appropriate fallback rating from the players table.
    const liveFallback = isSingles ? joined?.dupr_singles : joined?.dupr_doubles;
    const liveVerifiedFallback = isSingles ? joined?.dupr_singles_verified : joined?.dupr_verified;
    const partnerLiveFallback = isSingles ? partnerJoined?.dupr_singles : partnerJoined?.dupr_doubles;
    const partnerLiveVerifiedFallback = isSingles ? partnerJoined?.dupr_singles_verified : partnerJoined?.dupr_verified;
    const p: EventPlayer = {
      id: raw.id as string,
      player_name: raw.player_name as string,
      dupr_rating: raw.dupr_rating as number | null,
      partner_name: raw.partner_name as string | null,
      partner_dupr_rating: raw.partner_dupr_rating as number | null,
      team_avg_dupr: raw.team_avg_dupr as number | null,
      player_id: raw.player_id as string | null,
      partner_id: raw.partner_id as string | null,
      live_dupr: ((raw as Record<string, unknown>).enriched_dupr as number | null) ?? liveFallback ?? null,
      live_dupr_verified: ((raw as Record<string, unknown>).enriched_dupr_verified as boolean | null) ?? liveVerifiedFallback ?? null,
      partner_live_dupr: ((raw as Record<string, unknown>).partner_enriched_dupr as number | null) ?? partnerLiveFallback ?? null,
      partner_live_dupr_verified: ((raw as Record<string, unknown>).partner_enriched_dupr_verified as boolean | null) ?? partnerLiveVerifiedFallback ?? null,
      placement: (raw as Record<string, unknown>).placement as number | null,
    };
    if (!playersByEvent.has(eventId)) {
      playersByEvent.set(eventId, []);
    }
    playersByEvent.get(eventId)!.push(p);
  }

  return events.map((e: TournamentEvent) => ({
    ...e,
    players: playersByEvent.get(e.id) ?? [],
  }));
}

/**
 * Attach intelligence aggregate fields to tournaments.
 * Fetches event counts, total registered, avg field strength, max sandbagger pct
 * for tournaments that have event data.
 */
async function attachIntelligenceAggregates(
  tournaments: Tournament[],
): Promise<Tournament[]> {
  if (tournaments.length === 0) return tournaments;

  const ids = tournaments.map((t) => t.id);

  const { data: events, error } = await supabase
    .from("tournament_events")
    .select("tournament_id, registered_count, field_strength, sandbagger_pct")
    .in("tournament_id", ids);

  if (error || !events || events.length === 0) return tournaments;

  // Query verified live DUPR player counts per tournament
  const { data: liveCounts } = await supabase
    .from("event_players")
    .select("tournament_events!inner(tournament_id), player_id, players!event_players_player_id_fkey(dupr_verified)")
    .in("tournament_events.tournament_id", ids)
    .not("player_id", "is", null);

  const liveByTournament = new Map<string, number>();
  for (const row of (liveCounts ?? [])) {
    const tid = (row as any).tournament_events?.tournament_id as string;
    const verified = (row as any).players?.dupr_verified === true;
    if (tid && verified) {
      liveByTournament.set(tid, (liveByTournament.get(tid) ?? 0) + 1);
    }
  }

  // Aggregate per tournament
  const aggregates = new Map<string, {
    event_count: number;
    total_registered: number;
    field_strengths: number[];
    sandbagger_pcts: number[];
  }>();

  for (const e of events) {
    const tid = e.tournament_id as string;
    if (!aggregates.has(tid)) {
      aggregates.set(tid, { event_count: 0, total_registered: 0, field_strengths: [], sandbagger_pcts: [] });
    }
    const agg = aggregates.get(tid)!;
    agg.event_count++;
    agg.total_registered += (e.registered_count as number) ?? 0;
    if (e.field_strength != null) agg.field_strengths.push(e.field_strength as number);
    if (e.sandbagger_pct != null) agg.sandbagger_pcts.push(e.sandbagger_pct as number);
  }

  return tournaments.map((t) => {
    const agg = aggregates.get(t.id);
    if (!agg) return t;

    const avgFieldStrength = agg.field_strengths.length > 0
      ? agg.field_strengths.reduce((a, b) => a + b, 0) / agg.field_strengths.length
      : undefined;
    const maxSandbaggerPct = agg.sandbagger_pcts.length > 0
      ? Math.max(...agg.sandbagger_pcts)
      : undefined;

    return {
      ...t,
      event_count: agg.event_count,
      total_registered: agg.total_registered,
      avg_field_strength: avgFieldStrength != null ? Math.round(avgFieldStrength * 100) / 100 : undefined,
      max_sandbagger_pct: maxSandbaggerPct != null ? Math.round(maxSandbaggerPct * 100) / 100 : undefined,
      total_live_dupr: liveByTournament.get(t.id) ?? 0,
    };
  });
}

/**
 * Whether a player has been genuinely claimed. The claim flow writes the link
 * onto email_subscribers (player_id + link_status="linked"), NOT players.user_id —
 * so this is the source of truth for "claimed", gating The Read.
 */
export async function isPlayerClaimed(playerId: string): Promise<boolean> {
  try {
    const { count } = await supabase
      .from("email_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId)
      .eq("link_status", "linked");
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function getPlayer(id: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Player;
}

export interface RatingPoint {
  date: string;
  rating: number;
}

/** A player's doubles rating timeline (oldest → newest) from DUPR match history. */
export async function getPlayerRatingHistory(playerId: string): Promise<RatingPoint[]> {
  const { data, error } = await supabase
    .from("player_rating_history")
    .select("event_date, rating")
    .eq("player_id", playerId)
    .eq("format", "DOUBLES")
    .order("event_date", { ascending: true });

  if (error) {
    console.error("Error fetching rating history:", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    date: r.event_date as string,
    rating: Number(r.rating),
  }));
}

export interface PlayerTournamentHistory {
  tournamentId: string;
  tournamentName: string;
  dateStart: string;
  eventName: string;
  duprRating: number | null;
  partnerName: string | null;
}

export async function getPlayerTournamentHistory(
  playerId: string,
): Promise<PlayerTournamentHistory[]> {
  const { data, error } = await supabase
    .from("event_players")
    .select(`
      dupr_rating,
      partner_name,
      event_id,
      tournament_events!inner (
        name,
        skill_level_min,
        skill_level_max,
        tournament_id,
        tournaments!inner (
          id,
          name,
          date_start
        )
      )
    `)
    .eq("player_id", playerId)
    .order("dupr_rating", { ascending: false, nullsFirst: false });

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => {
    const event = row.tournament_events as Record<string, unknown>;
    const tournament = event.tournaments as Record<string, unknown>;
    return {
      tournamentId: tournament.id as string,
      tournamentName: tournament.name as string,
      dateStart: tournament.date_start as string,
      eventName: cleanRowEventName(event),
      duprRating: row.dupr_rating as number | null,
      partnerName: row.partner_name as string | null,
    };
  });
}

export async function getPlayerMatches(
  playerId: string,
  limit = 20,
): Promise<Match[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .or(
      `team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`,
    )
    .order("event_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching player matches:", error);
    return [];
  }

  return (data ?? []) as Match[];
}

/**
 * Current DUPR ratings for everyone this player has faced — used by the Giant
 * Slayer badge. One query keyed off the opponent ids found across their matches.
 * Current (not at-the-time) ratings are a fine approximation for "you beat a
 * team rated well above you."
 */
export async function getOpponentRatings(
  matches: Match[],
  playerId: string,
): Promise<Map<string, number>> {
  const ids = new Set<string>();
  for (const m of matches) {
    const onTeam1 = m.team1_player1_id === playerId || m.team1_player2_id === playerId;
    const opps = onTeam1
      ? [m.team2_player1_id, m.team2_player2_id]
      : [m.team1_player1_id, m.team1_player2_id];
    for (const o of opps) if (o) ids.add(o);
  }
  if (ids.size === 0) return new Map();

  const { data, error } = await supabase
    .from("players")
    .select("id, dupr_doubles, dupr_singles")
    .in("id", Array.from(ids));

  if (error) {
    console.error("Error fetching opponent ratings:", error);
    return new Map();
  }

  const map = new Map<string, number>();
  for (const p of data ?? []) {
    const r = (p.dupr_doubles ?? p.dupr_singles) as number | null;
    if (r != null) map.set(p.id as string, r);
  }
  return map;
}

export function computePlayerRecord(
  matches: Match[],
  playerId: string,
): PlayerRecord[] {
  const formatMap = new Map<string, { wins: number; losses: number }>();

  for (const match of matches) {
    const onTeam1 =
      match.team1_player1_id === playerId ||
      match.team1_player2_id === playerId;
    const won = onTeam1 ? match.team1_won : !match.team1_won;
    const fmt = match.event_format ?? "Unknown";

    if (!formatMap.has(fmt)) {
      formatMap.set(fmt, { wins: 0, losses: 0 });
    }
    const rec = formatMap.get(fmt)!;
    if (won) {
      rec.wins++;
    } else {
      rec.losses++;
    }
  }

  return Array.from(formatMap.entries()).map(([format, { wins, losses }]) => ({
    format,
    wins,
    losses,
  }));
}

export function computeFrequentPartners(
  matches: Match[],
  playerId: string,
): FrequentPartner[] {
  const partnerMap = new Map<
    string,
    { playerId: string | null; name: string; wins: number; losses: number }
  >();

  for (const match of matches) {
    const onTeam1 =
      match.team1_player1_id === playerId ||
      match.team1_player2_id === playerId;
    const won = onTeam1 ? match.team1_won : !match.team1_won;

    let partnerName: string | null = null;
    let partnerId: string | null = null;

    if (onTeam1) {
      if (match.team1_player1_id === playerId) {
        partnerName = match.team1_player2_name ?? null;
        partnerId = match.team1_player2_id ?? null;
      } else {
        partnerName = match.team1_player1_name ?? null;
        partnerId = match.team1_player1_id ?? null;
      }
    } else {
      if (match.team2_player1_id === playerId) {
        partnerName = match.team2_player2_name ?? null;
        partnerId = match.team2_player2_id ?? null;
      } else {
        partnerName = match.team2_player1_name ?? null;
        partnerId = match.team2_player1_id ?? null;
      }
    }

    if (!partnerName) continue;

    const key = partnerId ?? partnerName;
    if (!partnerMap.has(key)) {
      partnerMap.set(key, { playerId: partnerId, name: partnerName, wins: 0, losses: 0 });
    }
    const rec = partnerMap.get(key)!;
    if (won) {
      rec.wins++;
    } else {
      rec.losses++;
    }
  }

  return Array.from(partnerMap.entries())
    .map(([, v]) => ({
      playerId: v.playerId,
      name: v.name,
      matchCount: v.wins + v.losses,
      wins: v.wins,
      losses: v.losses,
    }))
    .filter((p) => p.matchCount >= 2) // a one-off pairing isn't "chemistry"
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 12); // keep a deep list; the UI shows top 5 with a "show all" expander
}

/**
 * Most-faced OPPONENTS (head-to-head). Mirrors computeFrequentPartners but
 * tallies the opposing team — in doubles each match has up to two opponents, so
 * a "meeting" is counted per individual opponent faced. wins/losses are from the
 * subject player's perspective. Filtered to repeat opponents (≥2 meetings) since
 * a single match isn't a rivalry, and capped to the few most-faced.
 */
export function computeFrequentOpponents(
  matches: Match[],
  playerId: string,
): FrequentOpponent[] {
  const oppMap = new Map<
    string,
    { playerId: string | null; name: string; wins: number; losses: number }
  >();

  for (const match of matches) {
    const onTeam1 =
      match.team1_player1_id === playerId ||
      match.team1_player2_id === playerId;
    const won = onTeam1 ? match.team1_won : !match.team1_won;

    const opponents = onTeam1
      ? [
          { id: match.team2_player1_id, name: match.team2_player1_name },
          { id: match.team2_player2_id, name: match.team2_player2_name },
        ]
      : [
          { id: match.team1_player1_id, name: match.team1_player1_name },
          { id: match.team1_player2_id, name: match.team1_player2_name },
        ];

    for (const opp of opponents) {
      if (!opp.name) continue;
      const key = opp.id ?? opp.name;
      if (!oppMap.has(key)) {
        oppMap.set(key, { playerId: opp.id ?? null, name: opp.name, wins: 0, losses: 0 });
      }
      const rec = oppMap.get(key)!;
      if (won) rec.wins++;
      else rec.losses++;
    }
  }

  return Array.from(oppMap.values())
    .map((v) => ({
      playerId: v.playerId,
      name: v.name,
      matchCount: v.wins + v.losses,
      wins: v.wins,
      losses: v.losses,
    }))
    .filter((o) => o.matchCount >= 2)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 5);
}

export interface PlayerUpcomingTournament {
  tournamentId: string;
  tournamentName: string;
  eventName: string;
  dateStart: string;
  listedDupr: number | null;
}

export interface PlayerPastTournament {
  tournamentId: string;
  name: string;
  date: string; // date_end ?? date_start (YYYY-MM-DD) — used to mark the rating timeline
}

/** Distinct PAST tournaments a player competed in, for rating-timeline markers. */
export async function getPlayerPastTournaments(
  playerId: string,
): Promise<PlayerPastTournament[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("event_players")
    .select(`
      tournament_events!inner (
        tournaments!inner ( id, name, date_start, date_end )
      )
    `)
    .eq("player_id", playerId)
    .lt("tournament_events.tournaments.date_end", today);

  if (error || !data) return [];

  // One row per registered event; dedupe to one marker per tournament.
  const seen = new Map<string, PlayerPastTournament>();
  for (const row of data as Record<string, unknown>[]) {
    const event = row.tournament_events as Record<string, unknown> | null;
    const t = event?.tournaments as Record<string, unknown> | null;
    if (!t) continue;
    const id = t.id as string;
    const date = (t.date_end as string) ?? (t.date_start as string);
    if (!id || !date || date >= today) continue;
    if (!seen.has(id)) seen.set(id, { tournamentId: id, name: t.name as string, date });
  }
  return Array.from(seen.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface OmniResults {
  players: { id: string; name: string; location: string | null; doubles: number | null }[];
  tournaments: { id: string; name: string; dateStart: string; venue: string | null }[];
  venues: { slug: string; name: string; address: string | null }[];
}

/** Omni search across players, tournaments, and venues by name (substring). */
export async function searchOmni(q: string): Promise<OmniResults> {
  const term = q.trim();
  if (term.length < 2) return { players: [], tournaments: [], venues: [] };
  const like = `%${term}%`;

  const [players, tournaments, venues] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, location, dupr_doubles")
      .ilike("name", like)
      .order("dupr_doubles", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from("tournaments")
      .select("id, name, date_start, location_name")
      .ilike("name", like)
      .eq("status", "active")
      .order("date_start", { ascending: true })
      .limit(5),
    supabase
      .from("venues")
      .select("slug, name, formatted_address")
      .ilike("name", like)
      .limit(5),
  ]);

  return {
    players: (players.data ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      location: (p.location as string | null) ?? null,
      doubles: (p.dupr_doubles as number | null) ?? null,
    })),
    tournaments: (tournaments.data ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      dateStart: t.date_start as string,
      venue: (t.location_name as string | null) ?? null,
    })),
    venues: (venues.data ?? []).map((v) => ({
      slug: v.slug as string,
      name: v.name as string,
      address: (v.formatted_address as string | null) ?? null,
    })),
  };
}

export async function getPlayerUpcomingTournaments(
  playerId: string,
): Promise<PlayerUpcomingTournament[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("event_players")
    .select(`
      dupr_rating,
      tournament_events!inner (
        name,
        skill_level_min,
        skill_level_max,
        tournament_id,
        tournaments!inner (
          id,
          name,
          date_start,
          date_end
        )
      )
    `)
    .eq("player_id", playerId)
    .gte("tournament_events.tournaments.date_end", today)
    .order("tournament_events.tournaments.date_start", { ascending: true });

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).flatMap((row) => {
    const event = row.tournament_events as Record<string, unknown> | null;
    if (!event) return [];
    const tournament = event.tournaments as Record<string, unknown> | null;
    if (!tournament) return [];
    const dateStart = tournament.date_start as string;
    const dateEnd = (tournament.date_end as string) ?? dateStart;
    if (dateEnd < today) return [];
    return [
      {
        tournamentId: tournament.id as string,
        tournamentName: tournament.name as string,
        eventName: cleanRowEventName(event),
        dateStart,
        listedDupr: row.dupr_rating as number | null,
      },
    ];
  });
}

// =============================================================================
// Venues
// Each venue-table read is wrapped so the build/queries degrade gracefully
// before migration 024 is applied (table/column absent → empty/null, no throw).
// =============================================================================

export async function getVenueBySlug(slug: string): Promise<Venue | null> {
  try {
    const { data, error } = await supabase
      .from("venues")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return data as Venue;
  } catch {
    return null;
  }
}

export async function getVenueTournaments(
  venueId: string,
): Promise<{ upcoming: Tournament[]; past: Tournament[] }> {
  const today = new Date().toISOString().split("T")[0];
  try {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("venue_id", venueId)
      .eq("status", "active")
      .order("date_start", { ascending: true });
    if (error || !data) return { upcoming: [], past: [] };

    const all = await attachIntelligenceAggregates(data as Tournament[]);
    const upcoming = all.filter((t) => (t.date_end ?? t.date_start) >= today);
    const past = all
      .filter((t) => (t.date_end ?? t.date_start) < today)
      .sort((a, b) => (b.date_start < a.date_start ? -1 : 1))
      .slice(0, 20);
    return { upcoming, past };
  } catch {
    return { upcoming: [], past: [] };
  }
}

export async function getVenuesForSitemap(): Promise<
  { slug: string; city_slug: string | null; updated_at: string }[]
> {
  try {
    const { data, error } = await supabase
      .from("venues")
      .select("slug, city_slug, updated_at, tournaments!inner(id)")
      .eq("tournaments.status", "active");
    if (error || !data) return [];
    // Dedupe (inner join can repeat a venue per tournament).
    const seen = new Map<string, { slug: string; city_slug: string | null; updated_at: string }>();
    for (const v of data as unknown as { slug: string; city_slug: string | null; updated_at: string }[]) {
      if (!seen.has(v.slug)) seen.set(v.slug, { slug: v.slug, city_slug: v.city_slug, updated_at: v.updated_at });
    }
    return [...seen.values()];
  } catch {
    return [];
  }
}
