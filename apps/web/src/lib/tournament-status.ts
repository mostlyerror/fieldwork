// tournaments.status is free text (no CHECK/enum in any migration). Values the
// app writes:
//   'active'    — scrapes / published flyers; the only publicly-listed status.
//   'draft'     — unpublished flyer drafts (work in progress, never went public).
//   'duplicate' — scraper cross-platform duplicates.
//   'archived'  — deliberately retired: a past tournament pulled off discovery
//                 surfaces (auto after 30 days past end, or manual). Still
//                 reachable by direct link and still appears in player histories;
//                 distinct from 'draft' (which never published in the first place).
export const TOURNAMENT_STATUS = {
  ACTIVE: "active",
  DRAFT: "draft",
  DUPLICATE: "duplicate",
  ARCHIVED: "archived",
} as const;

export type TournamentStatus =
  (typeof TOURNAMENT_STATUS)[keyof typeof TOURNAMENT_STATUS];

/** Only 'active' rows appear on public discovery surfaces (listings, search, map). */
export function isPublicStatus(status: string): boolean {
  return status === TOURNAMENT_STATUS.ACTIVE;
}

/** Retired past tournament — hidden from discovery but still directly reachable. */
export function isArchivedStatus(status: string | null | undefined): boolean {
  return status === TOURNAMENT_STATUS.ARCHIVED;
}
