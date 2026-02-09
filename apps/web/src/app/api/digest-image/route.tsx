import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return new Response("Missing from/to params", { status: 400 });
  }

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("name, date_start, location_name, entry_fee")
    .eq("status", "active")
    .gte("date_start", from)
    .lte("date_start", to)
    .order("date_start", { ascending: true })
    .limit(8);

  const items = tournaments ?? [];

  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T00:00:00");
  const weekendLabel = `${fromDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${toDate.getDate()}, ${toDate.getFullYear()}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #166534, #15803d, #22c55e)",
          padding: "50px",
          fontFamily: "Inter, sans-serif",
          color: "white",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "30px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: 36 }}>{"\u{1F3D3}"}</span>
            <span style={{ fontSize: 24, fontWeight: 700 }}>PickleRadar</span>
          </div>
          <span
            style={{
              fontSize: 18,
              opacity: 0.8,
              background: "rgba(255,255,255,0.15)",
              borderRadius: "9999px",
              padding: "6px 16px",
            }}
          >
            Weekend Digest
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: 36,
            fontWeight: 800,
            marginBottom: "8px",
          }}
        >
          This Weekend&apos;s Tournaments
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 20,
            opacity: 0.85,
            marginBottom: "28px",
          }}
        >
          {weekendLabel} &middot; Houston Area
        </div>

        {/* Tournament list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            flex: 1,
          }}
        >
          {items.map((t, i) => {
            const d = new Date(t.date_start + "T00:00:00");
            const dayStr = d.toLocaleDateString("en-US", { weekday: "short" });
            const fee =
              t.entry_fee != null
                ? t.entry_fee === 0
                  ? "Free"
                  : `$${t.entry_fee}`
                : "";
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: "12px",
                  padding: "10px 16px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      maxWidth: "700px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.name}
                  </span>
                  <span style={{ fontSize: 13, opacity: 0.8 }}>
                    {dayStr} &middot; {t.location_name}
                  </span>
                </div>
                {fee && (
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{fee}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            paddingTop: "16px",
            fontSize: 14,
            opacity: 0.6,
          }}
        >
          pickleradar.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
