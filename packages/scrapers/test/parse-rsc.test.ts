import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  parseRscTournamentData,
  type ParsedTournamentFields,
} from "../src/utils/parse-rsc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "fixtures");
const HTML_PATH = resolve(FIXTURES_DIR, "tournament-detail.html");
const EXPECTED_PATH = resolve(FIXTURES_DIR, "tournament-detail.expected.json");

describe("parseRscTournamentData – smoke test", () => {
  it("should have fixture files (run `npm run snapshot` first)", () => {
    expect(existsSync(HTML_PATH)).toBe(true);
    expect(existsSync(EXPECTED_PATH)).toBe(true);
  });

  it("should extract expected fields from the saved HTML snapshot", () => {
    const html = readFileSync(HTML_PATH, "utf-8");
    const expected: ParsedTournamentFields = JSON.parse(
      readFileSync(EXPECTED_PATH, "utf-8"),
    );

    const result = parseRscTournamentData(html);

    expect(result).not.toBeNull();
    expect(result).toEqual(expected);
  });

  it("should return null when tourneyId is missing from page content", () => {
    const result = parseRscTournamentData("<html><body>no rsc data</body></html>");
    expect(result).toBeNull();
  });
});
