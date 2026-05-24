export interface Tournament {
  id: string;
  name: string;
  date_start: string;
  date_end: string | null;
  location_name: string;
  location_address: string | null;
  latitude: number | null;
  longitude: number | null;
  skill_levels: string[] | null;
  format: string | null;
  entry_fee: number | null;
  registration_url: string | null;
  registration_status: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Intelligence aggregate fields (from tournament_events join)
  event_count?: number;
  total_registered?: number;
  avg_field_strength?: number;
  max_sandbagger_pct?: number;
}

export interface TournamentSource {
  id: string;
  tournament_id: string;
  source_platform: string;
  source_url: string | null;
  registration_url: string | null;
  created_at: string;
}

export interface TournamentEvent {
  id: string;
  tournament_id: string;
  name: string;
  event_type: string | null;
  gender: string | null;
  skill_level_min: number | null;
  skill_level_max: number | null;
  max_teams: number | null;
  registered_count: number;
  avg_dupr: number | null;
  field_strength: number | null;
  sandbagger_pct: number | null;
  players?: EventPlayer[];
}

export interface EventPlayer {
  id: string;
  player_name: string;
  dupr_rating: number | null;
  partner_name: string | null;
  partner_dupr_rating: number | null;
  team_avg_dupr: number | null;
  player_id: string | null;
  partner_id: string | null;
}

export interface Player {
  id: string;
  source_player_id: string;
  name: string;
  slug: string | null;
  location: string | null;
  gender: string | null;
  dupr_rating: number | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type FieldStrengthFilter = "all" | "friendly" | "competitive" | "stacked";

export interface TournamentFilters {
  search: string;
  skillLevels: string[];
  fieldStrength: FieldStrengthFilter;
}
