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
  registration_close_date: string | null;
  logo_url: string | null;
  venue_website: string | null;
  venue_id?: string | null;
  venue_slug?: string | null;
  venue_name?: string | null;
  venue_photo_url?: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Intelligence aggregate fields (from tournament_events join)
  event_count?: number;
  total_registered?: number;
  avg_field_strength?: number;
  max_sandbagger_pct?: number;
  total_live_dupr?: number;
}

export interface Venue {
  id: string;
  place_id: string | null;
  dedup_key: string;
  name: string;
  slug: string;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  city_slug: string | null;
  photo_url: string | null;   // v2
  website: string | null;     // v2
  source: string;
  created_at: string;
  updated_at: string;
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
  // Live DUPR from enrichment (joined from players table)
  live_dupr: number | null;
  live_dupr_verified: boolean | null;
  partner_live_dupr: number | null;
  partner_live_dupr_verified: boolean | null;
  placement: number | null;
}

export interface Player {
  id: string;
  source_player_id: string;
  name: string;
  slug: string | null;
  location: string | null;
  gender: string | null;
  dupr_doubles: number | null;
  dupr_singles: number | null;
  dupr_verified: boolean | null;
  dupr_singles_verified: boolean | null;
  dupr_last_checked: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  event_date: string;
  event_format: string;
  league: string | null;
  team1_player1_name: string;
  team1_player2_name: string | null;
  team2_player1_name: string;
  team2_player2_name: string | null;
  team1_player1_id: string | null;
  team1_player2_id: string | null;
  team2_player1_id: string | null;
  team2_player2_id: string | null;
  game1_team1: number | null;
  game1_team2: number | null;
  game2_team1: number | null;
  game2_team2: number | null;
  game3_team1: number | null;
  game3_team2: number | null;
  team1_won: boolean;
}

export interface PlayerRecord {
  format: string;
  wins: number;
  losses: number;
}

export interface FrequentPartner {
  playerId: string | null;
  name: string;
  matchCount: number;
  wins: number;
  losses: number;
}

export interface TournamentMatch {
  id: string;
  match_uuid: string;
  tournament_id: string;
  event_id: string | null;
  team1_player1_name: string | null;
  team1_player2_name: string | null;
  team2_player1_name: string | null;
  team2_player2_name: string | null;
  team1_rating: number | null;
  team2_rating: number | null;
  team1_seed: number | null;
  team2_seed: number | null;
  team1_scores: number[];
  team2_scores: number[];
  winner: number;
  match_status: number;
  round_number: number;
  match_number: number;
  round_text: string | null;
  bracket_type: string | null;
  pool_id: string | null;
  court_title: string | null;
  planned_start: string | null;
  match_start: string | null;
  match_completed: string | null;
}

export interface ResultCardData {
  playerName: string;
  partnerName: string | null;
  placement: number;
  dupr: number | null;
  partnerDupr: number | null;
  eventName: string;
  eventId: string;
  tournamentName: string;
  tournamentDate: string;
  venue: string;
  playerId: string;
  goldTeam: string | null;
  silverTeam: string | null;
  bronzeTeam: string | null;
}

export type FieldStrengthFilter = "all" | "friendly" | "competitive" | "stacked";

export interface TournamentFilters {
  search: string;
  skillLevels: string[];
  fieldStrength: FieldStrengthFilter;
}
