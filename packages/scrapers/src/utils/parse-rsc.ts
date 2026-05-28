/**
 * Pure function to extract tournament data from a PickleballTournaments.com
 * page's RSC (React Server Components) payload.
 *
 * The page embeds Next.js RSC data in self.__next_f.push() script tags.
 * We locate the "tourneyId" anchor and pull structured fields from the
 * surrounding escaped-JSON content.
 */

export interface ParsedTournamentFields {
  title: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  venueName: string | null;
  street: string | null;
  cityStateZip: string | null;
  status: string | null;
  latitude: string | null;
  longitude: string | null;
  venue: string | null;
  city: string | null;
  stateAbbreviation: string | null;
  costRegistrationCurrent: number | null;
  website: string | null;
}

/**
 * Extract an RSC string value from a chunk of page content.
 * Tries escaped quotes first (\\\"key\\\":\\\"value\\\"), then plain quotes.
 * Case-sensitive to avoid matching similar-named fields (e.g. DateStart
 * from registration fee periods vs dateStart for tournament dates).
 */
function rscStringValue(chunk: string, key: string): string | null {
  // Try escaped quotes: \"key\":\"value\"
  const escaped = new RegExp(`\\\\"${key}\\\\":\\s*\\\\"([^\\\\]*?)\\\\"`);
  const m1 = chunk.match(escaped);
  if (m1) {
    const v = m1[1];
    // Filter out RSC deferred references like "$undefined", "$4a"
    if (v.startsWith("$")) return null;
    return v;
  }
  // Try unescaped: "key":"value"
  const plain = new RegExp(`"${key}":\\s*"([^"]*?)"`);
  const m2 = chunk.match(plain);
  if (m2) {
    const v = m2[1];
    if (v.startsWith("$")) return null;
    return v;
  }
  return null;
}

/**
 * Parse RSC-embedded tournament data from raw page HTML.
 * Returns null if the "tourneyId" anchor is not found in the page.
 */
export function parseRscTournamentData(
  pageContent: string,
): ParsedTournamentFields | null {
  const tourneyIdx = pageContent.indexOf("tourneyId");
  if (tourneyIdx < 0) return null;

  const chunk = pageContent.slice(
    Math.max(0, tourneyIdx - 100),
    tourneyIdx + 10000,
  );

  const priceMatch = chunk.match(/costRegistrationCurrent[\\",]*:?\s*(\d+)/);
  const costRegistrationCurrent = priceMatch
    ? parseFloat(priceMatch[1])
    : null;

  return {
    title: rscStringValue(chunk, "title"),
    dateStart: rscStringValue(chunk, "dateStart"),
    dateEnd: rscStringValue(chunk, "dateEnd"),
    venueName: rscStringValue(chunk, "venueName"),
    street: rscStringValue(chunk, "street"),
    cityStateZip: rscStringValue(chunk, "cityStateZip"),
    status: rscStringValue(chunk, "status"),
    latitude: rscStringValue(chunk, "Latitude"),
    longitude: rscStringValue(chunk, "Longitude"),
    venue: rscStringValue(chunk, "Venue"),
    city: rscStringValue(chunk, "City"),
    stateAbbreviation: rscStringValue(chunk, "StateAbbreviation"),
    costRegistrationCurrent,
    website: rscStringValue(chunk, "website"),
  };
}
