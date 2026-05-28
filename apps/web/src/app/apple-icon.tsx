import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Apple touch icon — 180×180 with solid cream background (iOS auto-applies
 * rounded corners, so we leave it square). Inlined SVG at full canvas size
 * so the radar rings + sweep arc + pickleball all read sharply at this size.
 */
export default function AppleIcon() {
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
          width="180"
          height="180"
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
            strokeWidth="0.9"
            opacity="0.35"
          />
          {/* Middle radar ring */}
          <circle
            cx="12"
            cy="12"
            r="7.5"
            stroke="#065f46"
            strokeWidth="0.9"
            opacity="0.6"
          />
          {/* Gold radar sweep wedge */}
          <path
            d="M12 1.5 A 10.5 10.5 0 0 1 22.5 12 L 12 12 Z"
            fill="#d4af37"
            opacity="0.22"
          />
          <path
            d="M12 1.5 A 10.5 10.5 0 0 1 22.5 12"
            stroke="#d4af37"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          {/* Pickleball */}
          <circle cx="12" cy="12" r="4.6" fill="#d4af37" />
          <circle
            cx="12"
            cy="12"
            r="4.6"
            stroke="#065f46"
            strokeWidth="1.1"
          />
          {/* Crosshair holes */}
          <circle cx="12" cy="9.4" r="0.7" fill="#0a0a0a" />
          <circle cx="12" cy="14.6" r="0.7" fill="#0a0a0a" />
          <circle cx="9.4" cy="12" r="0.7" fill="#0a0a0a" />
          <circle cx="14.6" cy="12" r="0.7" fill="#0a0a0a" />
          <circle cx="12" cy="12" r="0.6" fill="#0a0a0a" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
