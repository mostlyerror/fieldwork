import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") || "Pickleball Tournament";
  const date = searchParams.get("date") || "";
  const venue = searchParams.get("venue") || "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #fffbeb 100%)",
          padding: "60px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "auto",
          }}
        >
          <div
            style={{
              fontSize: "40px",
            }}
          >
            🏓
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "#15803d",
            }}
          >
            PickleRadar
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "52px",
              fontWeight: 800,
              color: "#1a1a1a",
              lineHeight: 1.1,
              maxWidth: "900px",
            }}
          >
            {title}
          </div>
          {date && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  background: "#fef3c7",
                  borderRadius: "999px",
                  padding: "8px 20px",
                  fontSize: "24px",
                  fontWeight: 600,
                  color: "#92400e",
                }}
              >
                {date}
              </div>
            </div>
          )}
          {venue && (
            <div
              style={{
                fontSize: "26px",
                color: "#6b7280",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              📍 {venue}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "auto",
          }}
        >
          <div
            style={{
              fontSize: "20px",
              color: "#9ca3af",
            }}
          >
            pickleradar.app
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
