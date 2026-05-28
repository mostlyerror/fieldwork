/**
 * LogoMark — PickleRadar identity mark.
 *
 * Concept: a pickleball at the center pinging outward like a sonar source.
 * Two concentric radar rings sit behind the ball, a gold sweep arc shows the
 * "active ping," and the ball's holes are arranged on a crosshair grid so the
 * pickleball signature doubles as a radar reticle.
 *
 * Designed on a 24-unit grid so it stays legible at 24×24 in the header while
 * scaling cleanly to 32×32 (favicon) and 180×180 (apple touch icon).
 *
 * Brand palette only:
 *   #065f46 dark green   — primary rings, ball outline
 *   #d4af37 gold         — sweep arc, ball fill
 *   #0a0a0a dark ink     — ball holes / crosshair dots
 *   #FFFDF7 cream        — optional background (apple icon)
 */
export function LogoMark({
  size = 24,
  className = "",
  withBackground = false,
}: {
  size?: number;
  className?: string;
  /** Render an opaque cream background (used by app icons). */
  withBackground?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {withBackground && (
        <rect width="24" height="24" rx="5" fill="#FFFDF7" />
      )}

      {/* Outer radar ring */}
      <circle
        cx="12"
        cy="12"
        r="10.5"
        stroke="#065f46"
        strokeWidth="1.2"
        opacity="0.35"
      />
      {/* Middle radar ring */}
      <circle
        cx="12"
        cy="12"
        r="7.5"
        stroke="#065f46"
        strokeWidth="1.2"
        opacity="0.6"
      />

      {/* Gold radar sweep arc — a wedge from 12 o'clock to ~3 o'clock,
          drawn behind the ball to suggest an active ping. */}
      <path
        d="M12 1.5 A 10.5 10.5 0 0 1 22.5 12 L 12 12 Z"
        fill="#d4af37"
        opacity="0.22"
      />
      <path
        d="M12 1.5 A 10.5 10.5 0 0 1 22.5 12"
        stroke="#d4af37"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Pickleball — gold fill with dark green outline. Sits in the
          middle so the rings read as radar emanating from it. */}
      <circle cx="12" cy="12" r="4.6" fill="#d4af37" />
      <circle
        cx="12"
        cy="12"
        r="4.6"
        stroke="#065f46"
        strokeWidth="1.4"
      />

      {/* Pickleball holes laid out as a crosshair / reticle — N, S, E, W
          plus a center dot. Doubles as both the ball texture and the
          radar target pattern. */}
      <circle cx="12" cy="9.4" r="0.7" fill="#0a0a0a" />
      <circle cx="12" cy="14.6" r="0.7" fill="#0a0a0a" />
      <circle cx="9.4" cy="12" r="0.7" fill="#0a0a0a" />
      <circle cx="14.6" cy="12" r="0.7" fill="#0a0a0a" />
      <circle cx="12" cy="12" r="0.6" fill="#0a0a0a" />
    </svg>
  );
}
