/**
 * Parse structured data from tournament event names.
 *
 * Examples:
 *   "Men's Doubles 3.0-3.5"  -> { gender: "men", eventType: "doubles", skillMin: 3.0, skillMax: 3.5 }
 *   "Mixed Doubles 4.0+"     -> { gender: "mixed", eventType: "doubles", skillMin: 4.0, skillMax: null }
 *   "Women's Singles 3.5"    -> { gender: "women", eventType: "singles", skillMin: 3.5, skillMax: 3.5 }
 *   "Open Singles 4.5-5.0"   -> { gender: "open", eventType: "singles", skillMin: 4.5, skillMax: 5.0 }
 */

export interface ParsedEventName {
  gender: string | null;
  eventType: string | null;
  skillMin: number | null;
  skillMax: number | null;
}

export function parseEventName(name: string): ParsedEventName {
  const lower = name.toLowerCase();

  // Gender
  let gender: string | null = null;
  if (/\bmen'?s?\b/.test(lower) && !/\bwomen/.test(lower) && !/\bmixed\b/.test(lower)) {
    gender = "men";
  } else if (/\bwomen'?s?\b/.test(lower)) {
    gender = "women";
  } else if (/\bmixed\b/.test(lower)) {
    gender = "mixed";
  } else if (/\b(open|coed)\b/.test(lower)) {
    gender = "open";
  }

  // Event type
  let eventType: string | null = null;
  if (/\bsingles?\b/.test(lower)) {
    eventType = "singles";
  } else if (/\bdoubles?\b/.test(lower)) {
    eventType = "doubles";
  }

  // Skill levels — handle dash ranges ("3.0-3.5"), slash ranges ("2.5/3.0"),
  // open-ended ("4.0+", "4.0 and above"), ceilings ("3.499 and under"), and
  // single levels ("3.5"). PickleballBrackets wraps skill in "Skill: (....)"
  // alongside an Age clause like "(18 And Above)" — isolate the skill clause
  // first so the age bound can't be misread as a skill level.
  let skillMin: number | null = null;
  let skillMax: number | null = null;

  const skillClause = name.match(/skill:\s*\(([^)]*)\)/i);
  const skillText = skillClause ? skillClause[1] : name;
  const N = String.raw`\d+\.?\d*`;

  const rangeMatch = skillText.match(new RegExp(`(${N})\\s*(?:[-–]|to)\\s*(${N})`, "i"));
  const slashMatch = skillText.match(new RegExp(`(${N})\\s*/\\s*(${N})`));
  const underMatch = skillText.match(new RegExp(`(${N})\\s*(?:and|&)?\\s*under`, "i"));
  const aboveMatch = skillText.match(new RegExp(`(${N})\\s*(?:(?:and|&)\\s*(?:above|over)|\\+)`, "i"));
  const singleMatch = skillText.match(new RegExp(`(${N})`));

  if (rangeMatch) {
    skillMin = parseFloat(rangeMatch[1]);
    skillMax = parseFloat(rangeMatch[2]);
  } else if (slashMatch) {
    skillMin = parseFloat(slashMatch[1]);
    skillMax = parseFloat(slashMatch[2]);
  } else if (underMatch) {
    skillMin = null; // "X and under" → ceiling only
    skillMax = parseFloat(underMatch[1]);
  } else if (aboveMatch) {
    skillMin = parseFloat(aboveMatch[1]); // "X and above" / "X+" → floor only
    skillMax = null;
  } else if (singleMatch) {
    skillMin = parseFloat(singleMatch[1]);
    skillMax = skillMin;
  }

  return { gender, eventType, skillMin, skillMax };
}
