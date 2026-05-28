import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Favicon — renders the LogoMark at 32×32 with a cream background so it
 * survives both light and dark browser tab chrome. Inlined SVG (rather than
 * importing the component) because Satori parses the raw element tree here
 * and small visual tweaks (thicker strokes, slightly larger ball) help the
 * radar concept survive at this size.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFFDF7",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer radar ring */}
          <circle
            cx="12"
            cy="12"
            r="10.5"
            stroke="#065f46"
            strokeWidth="1.4"
            opacity="0.4"
          />
          {/* Middle radar ring */}
          <circle
            cx="12"
            cy="12"
            r="7.5"
            stroke="#065f46"
            strokeWidth="1.4"
            opacity="0.7"
          />
          {/* Gold radar sweep wedge */}
          <path
            d="M12 1.5 A 10.5 10.5 0 0 1 22.5 12 L 12 12 Z"
            fill="#d4af37"
            opacity="0.28"
          />
          <path
            d="M12 1.5 A 10.5 10.5 0 0 1 22.5 12"
            stroke="#d4af37"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Pickleball */}
          <circle cx="12" cy="12" r="4.8" fill="#d4af37" />
          <circle
            cx="12"
            cy="12"
            r="4.8"
            stroke="#065f46"
            strokeWidth="1.6"
          />
          {/* Crosshair holes */}
          <circle cx="12" cy="9.4" r="0.85" fill="#0a0a0a" />
          <circle cx="12" cy="14.6" r="0.85" fill="#0a0a0a" />
          <circle cx="9.4" cy="12" r="0.85" fill="#0a0a0a" />
          <circle cx="14.6" cy="12" r="0.85" fill="#0a0a0a" />
          <circle cx="12" cy="12" r="0.7" fill="#0a0a0a" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
