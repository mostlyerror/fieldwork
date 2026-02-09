import type { Tournament, TournamentSource } from "@/lib/types";

export const mockTournament: Tournament = {
  id: "mock-1",
  name: "Houston Spring Smash Open",
  date_start: "2025-03-15",
  date_end: "2025-03-16",
  location_name: "Memorial Park Tennis Center",
  location_address: "1500 Memorial Loop Dr, Houston, TX 77007",
  latitude: 29.7648,
  longitude: -95.4345,
  skill_levels: ["3.0", "3.5", "4.0", "4.5", "5.0"],
  format: "double_elim",
  entry_fee: 65,
  registration_url: "https://example.com/register",
  registration_status: "open",
  description:
    "Join us for the biggest spring pickleball event in Houston! This two-day tournament features double elimination brackets across five skill divisions. Complimentary water and snacks provided. Medal ceremonies at 5pm Sunday. All participants receive a tournament t-shirt.\n\nParking is available in the Memorial Park lot off Memorial Loop Drive. Please arrive 30 minutes before your first scheduled match for check-in.",
  status: "active",
  created_at: "2025-01-15T00:00:00Z",
  updated_at: "2025-02-01T00:00:00Z",
};

export const mockSources: TournamentSource[] = [
  {
    id: "src-1",
    tournament_id: "mock-1",
    source_platform: "pickleballbrackets",
    source_url: "https://pickleballbrackets.com/event/123",
    registration_url: "https://pickleballbrackets.com/event/123/register",
    created_at: "2025-01-15T00:00:00Z",
  },
  {
    id: "src-2",
    tournament_id: "mock-1",
    source_platform: "pickleball_den",
    source_url: "https://pickleballden.com/tournaments/456",
    registration_url: "https://pickleballden.com/tournaments/456/signup",
    created_at: "2025-01-16T00:00:00Z",
  },
];

export const FORMAT_LABELS: Record<string, string> = {
  round_robin: "Round Robin",
  single_elim: "Single Elimination",
  double_elim: "Double Elimination",
  mixed: "Mixed",
};

export const SOURCE_NAMES: Record<string, string> = {
  pickleballbrackets: "PickleballBrackets",
  pickleball_den: "Pickleball Den",
  manual: "Direct Link",
};
