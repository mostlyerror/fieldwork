/**
 * Clean up scraped event names for display.
 *
 * Source names are wildly inconsistent. Some are already tidy
 * ("Men's Doubles (4.0)", "Girl's Doubles 14U"), but many carry verbose
 * machine cruft:
 *
 *   "Mens Doubles Skill: (3.499 And Under) Saturday Age: (50 To 59)"
 *   "Mens Singles Skill: (3.5-3.999) Age: (Any) Friday Age: (70 And Above)"
 *
 * We strip the "Skill: (...)" / "Age: (Any)" / day-of-week noise, rebuild a
 * compact skill label from the already-parsed skill_level_min/max columns
 * (not the messy string), and reformat real age divisions. Names with no
 * "Skill:" token are assumed already clean and pass through untouched.
 */

interface NamedEvent {
  name: string;
  skill_level_min: number | null;
  skill_level_max: number | null;
}

const DAY_RE = /\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/gi;
const SKILL_RE = /Skill:\s*\([^)]*\)/gi;
const AGE_RE = /Age:\s*\(([^)]*)\)/gi;

const g1 = (v: number) => v.toFixed(1); // 3 -> "3.0", 3.5 -> "3.5"

/** Compact skill-window label from the parsed bounds. */
function compactSkill(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min == null) return `≤${g1(max as number)}`;
  if (max == null) return `${g1(min)}+`;
  if (Math.abs(min - max) < 0.01) return g1(min);
  return `${g1(min)}–${g1(max)}`;
}

/** Reformat one "Age: (...)" inner value, or null for "Any" / unparseable. */
function formatAge(inner: string): string | null {
  const s = inner.trim();
  if (/^any/i.test(s)) return null;
  let m = s.match(/^(\d+)\s*\+$/);
  if (m) return `${+m[1]}+`;
  m = s.match(/^(\d+)\s*(?:and|&)\s*(?:above|over)$/i);
  if (m) return `${+m[1]}+`;
  m = s.match(/^(\d+)\s*(?:and|&)\s*under$/i);
  if (m) return `${+m[1]}U`;
  m = s.match(/^(\d+)\s*to\s*(\d+)$/i);
  if (m) return `${+m[1]}–${+m[2]}`;
  return s; // unknown shape — keep as-is rather than drop info
}

export function cleanEventName(event: NamedEvent): string {
  const raw = event.name ?? "";
  const hadSkill = /Skill:\s*\(/i.test(raw);

  // pull meaningful age divisions out (drop "Any")
  const ages: string[] = [];
  let n = raw.replace(AGE_RE, (_full, inner: string) => {
    const a = formatAge(inner);
    if (a) ages.push(a);
    return " ";
  });

  n = n.replace(SKILL_RE, " ").replace(DAY_RE, " ");
  // collapse separators left behind, trim stray dashes/dots at the edges
  n = n
    .replace(/\s+[-–·|]\s+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–·|]+|[\s\-–·|]+$/g, "")
    .trim();

  const skill = hadSkill ? compactSkill(event.skill_level_min, event.skill_level_max) : null;
  const age = ages.length ? ages[ages.length - 1] : null;

  let out = n;
  if (skill) out += ` (${skill})`;
  if (age) out += ` ${age}`;
  return out || raw.trim();
}
