import { createHash } from "crypto";

/**
 * Generate a SHA-256 hash of content for change detection.
 * Used to compare page content between scraper runs so we only
 * re-parse and upsert when something has actually changed.
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
