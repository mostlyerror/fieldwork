import { supabase } from "./supabase";
import type { Tournament, TournamentSource } from "./types";

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
  return data ?? [];
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
  return data;
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
