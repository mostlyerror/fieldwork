/**
 * Shared inline-SVG icon set — clean, single-weight (stroke 1.8), currentColor.
 * Used in place of emoji on browsing surfaces (cost-conscious: no icon-library
 * dependency, tree-shaken, matches the app's existing hand-SVG pattern).
 * Size + color via className (e.g. "h-4 w-4 text-emerald-700").
 */
type IconProps = { className?: string };

const base = (className?: string) => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </svg>
  );
}

export function MapPinIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 5.6M16.8 20a5.5 5.5 0 0 0-2.3-4.5" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...base(className)} strokeWidth={2}>
      <path d="M5 12h13M13 6.5 18.5 12 13 17.5" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="5" y="11" width="14" height="9" rx="2.2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function MedalIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M8 4 9.5 9M16 4l-1.5 5" />
      <circle cx="12" cy="15" r="5.2" />
      <path d="M12 12.6l.9 1.8 2 .3-1.45 1.4.34 2L12 17.1l-1.79.95.34-2L9.1 14.7l2-.3.9-1.8Z" />
    </svg>
  );
}

/** Radar-paddle brand mark (stroke-only, harmonized with the line set). */
export function RadarMarkIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeOpacity="0.45" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="5.4" strokeOpacity="0.75" strokeWidth="1.7" />
      <path d="M12 3a9 9 0 0 1 9 9" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  );
}
