/**
 * PickleRadar radar-paddle logomark, tuned for dark (emerald) backgrounds —
 * white concentric rings, a gold sweep, and a paddle face with ball holes.
 * Used in the auth shell's mobile header and desktop brand panel.
 */
export function RadarMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="7.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
      <path d="M12 1.5 A 10.5 10.5 0 0 1 22.5 12 L 12 12 Z" fill="#d4af37" opacity="0.22" />
      <path
        d="M12 1.5 A 10.5 10.5 0 0 1 22.5 12"
        stroke="#d4af37"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="4.6" fill="#d4af37" />
      <circle cx="12" cy="12" r="4.6" stroke="rgba(255,255,255,0.85)" strokeWidth="1.4" />
      <circle cx="12" cy="9.4" r="0.7" fill="#0a0a0a" />
      <circle cx="12" cy="14.6" r="0.7" fill="#0a0a0a" />
      <circle cx="9.4" cy="12" r="0.7" fill="#0a0a0a" />
      <circle cx="14.6" cy="12" r="0.7" fill="#0a0a0a" />
      <circle cx="12" cy="12" r="0.6" fill="#0a0a0a" />
    </svg>
  );
}
