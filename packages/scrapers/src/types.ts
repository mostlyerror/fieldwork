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
