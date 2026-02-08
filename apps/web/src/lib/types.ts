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
}

export interface TournamentSource {
  id: string;
  tournament_id: string;
  source_platform: string;
  source_url: string | null;
  registration_url: string | null;
  created_at: string;
}

export interface TournamentFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  skillLevels: string[];
  format: string;
}
