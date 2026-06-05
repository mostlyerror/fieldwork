/**
 * Shared prop contracts for the Scouting Report player page modules.
 * Field shapes match the real data layer (see lib/queries.ts, lib/types.ts).
 */
import type { Match } from "@/lib/types";

export interface IdentityBandProps {
  name: string;
  location: string | null;
  duprDoubles: number | null;
  duprSingles: number | null;
  doublesVerified: boolean;
  singlesVerified: boolean;
  formLabel: string;
  lastUpdated: string | null;
}

export interface TheReadProps {
  read: string;
}

export interface RecordModuleProps {
  overall: { wins: number; losses: number };
  doubles: { wins: number; losses: number };
  singles: { wins: number; losses: number };
}

export interface RatingTrendProps {
  points: { date: string; rating: number }[];
  current: number | null;
  delta: number | null;
  peak: number | null;
  low: number | null;
  trendLabel: string;
}

export interface PartnerRow {
  name: string;
  playerId: string | null;
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
  verdict: string | null;
}

export interface PartnerChemistryProps {
  partners: PartnerRow[];
}

export interface RecentMatchesProps {
  matches: Match[];
  playerId: string;
  totalCount: number;
}
