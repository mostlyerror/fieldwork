export const HOUSTON_LAT = 29.7604;
export const HOUSTON_LNG = -95.3698;

export const SKILL_LEVELS = [
  "2.0",
  "2.5",
  "3.0",
  "3.5",
  "4.0",
  "4.5",
  "5.0",
  "5.0+",
  "Pro",
] as const;

export const SKILL_LEVEL_COLORS: Record<string, string> = {
  "2.0": "bg-sky-100 text-sky-800",
  "2.5": "bg-sky-100 text-sky-800",
  "3.0": "bg-blue-100 text-blue-800",
  "3.5": "bg-indigo-100 text-indigo-800",
  "4.0": "bg-purple-100 text-purple-800",
  "4.5": "bg-fuchsia-100 text-fuchsia-800",
  "5.0": "bg-rose-100 text-rose-800",
  "5.0+": "bg-rose-100 text-rose-800",
  Pro: "bg-rose-100 text-rose-800",
};

export const FORMAT_OPTIONS = [
  { value: "", label: "All Formats" },
  { value: "round_robin", label: "Round Robin" },
  { value: "single_elim", label: "Single Elimination" },
  { value: "double_elim", label: "Double Elimination" },
  { value: "mixed", label: "Mixed" },
] as const;

export const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  pickleballbrackets: "PickleballBrackets",
  pickleball_den: "Pickleball Den",
  manual: "Direct Link",
};

export const DEFAULT_MAP_VIEW = {
  longitude: HOUSTON_LNG,
  latitude: HOUSTON_LAT,
  zoom: 9,
} as const;
