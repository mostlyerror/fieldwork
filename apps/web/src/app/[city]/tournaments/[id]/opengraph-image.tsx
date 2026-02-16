import { ImageResponse } from "next/og";
import { getTournament } from "@/lib/queries";
import { formatDateRange, formatCurrency } from "@/lib/format";

export const runtime = "edge";
export const alt = "PickleRadar Tournament";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ city: string; id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournament(id);

  if (!tournament) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #166534, #15803d, #22c55e)",
            color: "white",
            fontSize: 48,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Tournament Not Found
        </div>
      ),
      { ...size }
    );
  }

  const dateStr = formatDateRange(tournament.date_start, tournament.date_end);
  const fee =
    tournament.entry_fee != null ? formatCurrency(tournament.entry_fee) : null;
  const skills = tournament.skill_levels ?? [];
  const status = tournament.registration_status ?? "open";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #166534, #15803d, #22c55e)",
          padding: "60px",
          fontFamily: "Inter, sans-serif",
          color: "white",
        }}
      >
        {/* Top row: branding + status */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "40px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: 40 }}>{"\u{1F3D3}"}</span>
            <span
              style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px" }}
            >
              PickleRadar
            </span>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.2)",
              borderRadius: "9999px",
              padding: "8px 20px",
              fontSize: 18,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {status}
          </div>
        </div>

        {/* Tournament name */}
        <div
          style={{
            fontSize: tournament.name.length > 50 ? 40 : 52,
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: "28px",
            maxWidth: "900px",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {tournament.name}
        </div>

        {/* Details row */}
        <div
          style={{
            display: "flex",
            gap: "32px",
            fontSize: 22,
            opacity: 0.95,
            marginBottom: "24px",
            flexWrap: "wrap",
          }}
        >
          <span>{dateStr}</span>
          <span>{"\u2022"}</span>
          <span>{tournament.location_name}</span>
          {fee && (
            <>
              <span>{"\u2022"}</span>
              <span>{fee}</span>
            </>
          )}
        </div>

        {/* Skill level pills */}
        {skills.length > 0 && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {skills.slice(0, 8).map((s) => (
              <div
                key={s}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  borderRadius: "9999px",
                  padding: "6px 16px",
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}

        {/* Bottom branding */}
        <div
          style={{
            marginTop: "auto",
            fontSize: 16,
            opacity: 0.7,
          }}
        >
          pickleradar.app
        </div>
      </div>
    ),
    { ...size }
  );
}
