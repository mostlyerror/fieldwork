import { supabase } from "./supabase";
import type { Tournament, TournamentSource, TournamentEvent, EventPlayer } from "./types";
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

  // Fetch players for all events
  const eventIds = events.map((e: TournamentEvent) => e.id);
  const { data: players, error: playersError } = await supabase
    .from("event_players")
    .select("*")
    .in("event_id", eventIds)
    .order("dupr_rating", { ascending: false, nullsFirst: false });

  if (playersError) {
    console.error("Error fetching event players:", playersError);
  }

  // Group players by event
  const playersByEvent = new Map<string, EventPlayer[]>();
  for (const p of (players ?? []) as EventPlayer[]) {
    const eventId = (p as EventPlayer & { event_id: string }).event_id;
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
