// tournaments.status is free text (no CHECK/enum in any migration). These are the
// only values the app writes: scrapes/published flyers are 'active', scraper
// cross-platform duplicates are 'duplicate', unpublished flyers are 'draft'.
export const TOURNAMENT_STATUS = {
  ACTIVE: "active",
  DRAFT: "draft",
  DUPLICATE: "duplicate",
} as const;

export type TournamentStatus =
  (typeof TOURNAMENT_STATUS)[keyof typeof TOURNAMENT_STATUS];

/** Only 'active' rows appear on public surfaces. */
export function isPublicStatus(status: string): boolean {
  return status === TOURNAMENT_STATUS.ACTIVE;
}
