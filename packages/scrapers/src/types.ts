export interface ScrapedPlayer {
  name: string;
  duprRating?: number;
  partnerName?: string;
  partnerDuprRating?: number;
  // Identity fields from PBB
  sourcePlayerId?: string;         // PBB playerId UUID
  sourceSlug?: string;             // PBB playerSlug
  location?: string;               // PBB playerCityState
  gender?: string;                 // "Male", "Female"
  partnerSourcePlayerId?: string;  // PBB partnerId UUID
}

export interface ScrapedEvent {
  name: string;
  eventType?: string;        // singles, doubles, mixed
  gender?: string;           // men, women, mixed, open
  skillLevelMin?: number;
  skillLevelMax?: number;
  maxTeams?: number;
  registeredCount?: number;
  players: ScrapedPlayer[];
  sourceEventId?: string;
}

export interface ScrapedTournament {
  name: string;
  dateStart: string; // ISO date (YYYY-MM-DD)
  dateEnd?: string;
  locationName: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
  skillLevels: string[];
  format?: string; // 'round_robin', 'single_elim', 'double_elim', 'mixed'
  entryFee?: number;
  registrationUrl: string;
  registrationStatus?: string; // 'open', 'filling', 'full', 'closed'
  sourcePlatform: string;
  sourceUrl: string;
  description?: string;
  rawPageHash: string;
  events?: ScrapedEvent[];
}

export interface ScraperResult {
  sourcePlatform: string;
  tournaments: ScrapedTournament[];
  tournamentsNew: number;
  tournamentsUpdated: number;
  error?: string;
}

export interface ScraperSource {
  name: string;
  scrape(): Promise<ScrapedTournament[]>;
}
