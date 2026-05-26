import { supabase } from "./supabase";
import type { Tournament, TournamentSource, TournamentEvent, EventPlayer, Player } from "./types";
import { getCityBySlug, getDefaultCity } from "./cities";

export async function getTournaments(): Promise<Tournament[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("status", "active")
    .gte("date_start", today)
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
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching tournament:", error);
    return null;
  }

  const tournament = data as Tournament;

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
    .select("*, players!event_players_player_id_fkey(dupr_rating, dupr_verified), partner:players!event_players_partner_id_fkey(dupr_rating, dupr_verified)")
    .in("event_id", eventIds)
    .order("dupr_rating", { ascending: false, nullsFirst: false });

  if (playersError) {
    console.error("Error fetching event players:", playersError);
  }

  // Group players by event, flattening the joined player data
  const playersByEvent = new Map<string, EventPlayer[]>();
  for (const raw of (players ?? [])) {
    const eventId = (raw as Record<string, unknown>).event_id as string;
    const joined = (raw as Record<string, unknown>).players as { dupr_rating: number | null; dupr_verified: boolean | null } | null;
    const partnerJoined = (raw as Record<string, unknown>).partner as { dupr_rating: number | null; dupr_verified: boolean | null } | null;
    const p: EventPlayer = {
      id: raw.id as string,
      player_name: raw.player_name as string,
      dupr_rating: raw.dupr_rating as number | null,
      partner_name: raw.partner_name as string | null,
      partner_dupr_rating: raw.partner_dupr_rating as number | null,
      team_avg_dupr: raw.team_avg_dupr as number | null,
      player_id: raw.player_id as string | null,
      partner_id: raw.partner_id as string | null,
      live_dupr: joined?.dupr_rating ?? null,
      live_dupr_verified: joined?.dupr_verified ?? null,
      partner_live_dupr: partnerJoined?.dupr_rating ?? null,
      partner_live_dupr_verified: partnerJoined?.dupr_verified ?? null,
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
    };
  });
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
      eventName: event.name as string,
      duprRating: row.dupr_rating as number | null,
      partnerName: row.partner_name as string | null,
    };
  });
}
