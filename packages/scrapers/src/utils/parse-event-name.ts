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

  // Skill levels — look for patterns like "3.0-3.5", "4.0+", "2.5/3.0", "3.5"
  let skillMin: number | null = null;
  let skillMax: number | null = null;

  // Range: "3.0-3.5" or "3.0 - 3.5" or "3.000 – 3.499"
  const rangeMatch = name.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
  if (rangeMatch) {
    skillMin = parseFloat(rangeMatch[1]);
    skillMax = parseFloat(rangeMatch[2]);
  }

  // Slash-separated range: "2.5/3.0" (common in senior events)
  if (skillMin == null) {
    const slashMatch = name.match(/(\d+\.\d+)\s*\/\s*(\d+\.\d+)/);
    if (slashMatch) {
      skillMin = parseFloat(slashMatch[1]);
      skillMax = parseFloat(slashMatch[2]);
    }
  }

  if (skillMin == null) {
    // Open-ended: "4.0+" or "4.0 and above"
    const plusMatch = name.match(/(\d+\.\d+)\s*\+/);
    if (plusMatch) {
      skillMin = parseFloat(plusMatch[1]);
      skillMax = null;
    } else {
      // Single level in parentheses or standalone: "(3.5)" or "3.5"
      // Prefer "Skill: (X.X)" format if present
      const skillColonMatch = name.match(/skill:\s*\((\d+\.?\d*)\)/i);
      const singleMatch = skillColonMatch || name.match(/(\d+\.\d+)/);
      if (singleMatch) {
        skillMin = parseFloat(singleMatch[1]);
        skillMax = skillMin;
      }
    }
  }

  return { gender, eventType, skillMin, skillMax };
}
