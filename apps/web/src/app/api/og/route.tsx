import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Brand font (Plus Jakarta Sans) — Satori ignores fontWeight unless real font
// files are embedded, so without these the card falls back to a limp default
// sans. Colocated TTFs are bundled and fetched at render time (edge-safe).
const fontSemiBold = fetch(new URL("./fonts/PlusJakartaSans-600.ttf", import.meta.url)).then((r) => r.arrayBuffer());
const fontBold = fetch(new URL("./fonts/PlusJakartaSans-700.ttf", import.meta.url)).then((r) => r.arrayBuffer());
const fontExtraBold = fetch(new URL("./fonts/PlusJakartaSans-800.ttf", import.meta.url)).then((r) => r.arrayBuffer());

// PickleRadar LogoMark as an inline SVG data URI — replaces the 🏓 emoji, which
// Satori renders as a flat low-res blob. Kept in sync with components/logo-mark.tsx.
function logoMark(size: number): string {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10.5" stroke="#065f46" stroke-width="1.2" opacity="0.35"/><circle cx="12" cy="12" r="7.5" stroke="#065f46" stroke-width="1.2" opacity="0.6"/><path d="M12 1.5 A 10.5 10.5 0 0 1 22.5 12 L 12 12 Z" fill="#d4af37" opacity="0.22"/><path d="M12 1.5 A 10.5 10.5 0 0 1 22.5 12" stroke="#d4af37" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="12" r="4.6" fill="#d4af37"/><circle cx="12" cy="12" r="4.6" stroke="#065f46" stroke-width="1.4"/><circle cx="12" cy="9.4" r="0.7" fill="#0a0a0a"/><circle cx="12" cy="14.6" r="0.7" fill="#0a0a0a"/><circle cx="9.4" cy="12" r="0.7" fill="#0a0a0a"/><circle cx="14.6" cy="12" r="0.7" fill="#0a0a0a"/><circle cx="12" cy="12" r="0.6" fill="#0a0a0a"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Dynamic headline sizing shared by the new card styles.
function headlineSize(name: string): string {
  const n = name.length;
  return n > 56 ? "52px" : n > 44 ? "62px" : n > 32 ? "76px" : n > 20 ? "92px" : "104px";
}

// Contextual bottom-right badge (urgency → entry fee fallback).
function contextBadge(d: CardData): { label: string; value: string; bg: string; fg: string } {
  if (d.urgency && d.urgency.includes("CLOSED")) return { label: "REGISTRATION", value: "CLOSED", bg: "#1a1a1a", fg: "#9ca3af" };
  if (d.urgency && d.urgency.includes("h")) return { label: "HURRY", value: d.urgency.toUpperCase(), bg: "#dc2626", fg: "#FFFDF7" };
  if (d.urgency) return { label: "CLOSES", value: d.urgency.replace("Closes in ", "IN ").toUpperCase(), bg: "#d4af37", fg: "#0a0a0a" };
  return { label: "ENTRY", value: d.t.entry_fee != null ? `$${d.t.entry_fee}` : "FREE", bg: "#d4af37", fg: "#0a0a0a" };
}

interface TournamentRow {
  name: string;
  date_start: string;
  date_end: string | null;
  location_name: string;
  entry_fee: number | null;
  registration_close_date: string | null;
  logo_url: string | null;
}

interface Intel {
  event_count: number;
  total_registered: number;
  total_live_dupr: number;
  max_sandbagger_pct: number | null;
  avg_dupr: number | null;
}

interface CardData {
  t: TournamentRow;
  intel: Intel;
  dateRange: string;
  urgency: string | null;
  hasSandbagger: boolean;
}

function formatDateRange(start: string, end: string | null): string {
  const s = new Date(start + "T00:00:00");
  const startStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (!end || start === end) return startStr;
  const e = new Date(end + "T00:00:00");
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  if (sameMonth) {
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function urgencyText(closeDate: string | null): string | null {
  if (!closeDate) return null;
  const ms = new Date(closeDate).getTime() - Date.now();
  if (ms < 0) return "REGISTRATION CLOSED";
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `Closes in ${Math.max(1, Math.round(hours))}h`;
  const days = Math.ceil(hours / 24);
  if (days <= 7) return `Closes in ${days} day${days === 1 ? "" : "s"}`;
  return null;
}

async function fetchData(id: string): Promise<CardData | null> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name, date_start, date_end, location_name, entry_fee, registration_close_date, logo_url")
    .eq("id", id)
    .maybeSingle();

  if (!tournament) return null;

  const { data: events } = await supabase
    .from("tournament_events")
    .select("id, registered_count, avg_dupr, sandbagger_pct")
    .eq("tournament_id", id);

  const eventIds = events?.map((e) => e.id) ?? [];
  let totalLiveDupr = 0;
  if (eventIds.length > 0) {
    const { count } = await supabase
      .from("event_players")
      .select("id", { count: "exact", head: true })
      .in("event_id", eventIds)
      .not("enriched_dupr", "is", null);
    totalLiveDupr = count ?? 0;
  }

  const event_count = events?.length ?? 0;
  const total_registered = events?.reduce((s, e) => s + (e.registered_count as number || 0), 0) ?? 0;
  const sandbaggerPcts = (events ?? []).map((e) => e.sandbagger_pct as number | null).filter((p): p is number => p != null && p > 0);
  const max_sandbagger_pct = sandbaggerPcts.length > 0 ? Math.max(...sandbaggerPcts) : null;
  const avgDuprs = (events ?? []).map((e) => e.avg_dupr as number | null).filter((d): d is number => d != null);
  const avg_dupr = avgDuprs.length > 0 ? avgDuprs.reduce((a, b) => a + b, 0) / avgDuprs.length : null;

  const t = tournament as TournamentRow;
  return {
    t,
    intel: { event_count, total_registered, total_live_dupr: totalLiveDupr, max_sandbagger_pct, avg_dupr },
    dateRange: formatDateRange(t.date_start, t.date_end),
    urgency: urgencyText(t.registration_close_date),
    hasSandbagger: max_sandbagger_pct != null && max_sandbagger_pct > 0.2,
  };
}

// ============ STYLES ============

// 1. Editorial Cream — warm magazine
function Style_editorial({ d }: { d: CardData }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFDF7", padding: "56px 64px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", fontSize: "24px" }}>🏓</div>
          <div style={{ display: "flex", fontSize: "18px", fontWeight: 900, color: "#065f46", letterSpacing: "3px" }}>PICKLERADAR</div>
        </div>
        {d.urgency && <div style={{ display: "flex", fontSize: "14px", fontWeight: 800, color: "#b91c1c", background: "#fef2f2", padding: "6px 14px", borderRadius: "999px", letterSpacing: "1px" }}>{d.urgency}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: d.t.name.length > 40 ? "52px" : "64px", fontWeight: 900, color: "#0a0a0a", lineHeight: 1.0, letterSpacing: "-1.5px", maxWidth: "1050px" }}>{d.t.name}</div>
        <div style={{ display: "flex", alignItems: "center", marginTop: "18px", gap: "14px" }}>
          <div style={{ display: "flex", fontSize: "24px", color: "#065f46", fontWeight: 800 }}>{d.dateRange}</div>
          <div style={{ display: "flex", fontSize: "24px", color: "#d1d5db" }}>·</div>
          <div style={{ display: "flex", fontSize: "24px", color: "#374151", fontWeight: 600 }}>{d.t.location_name}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "14px" }}>
        {d.intel.total_registered > 0 && <div style={{ display: "flex", flexDirection: "column", background: "#f0fdf4", borderRadius: "10px", padding: "12px 18px" }}><div style={{ display: "flex", fontSize: "12px", color: "#065f46", fontWeight: 700, letterSpacing: "2px" }}>REGISTERED</div><div style={{ display: "flex", fontSize: "28px", fontWeight: 900, color: "#065f46" }}>{d.intel.total_registered}</div></div>}
        {d.intel.event_count > 0 && <div style={{ display: "flex", flexDirection: "column", background: "#f0fdf4", borderRadius: "10px", padding: "12px 18px" }}><div style={{ display: "flex", fontSize: "12px", color: "#065f46", fontWeight: 700, letterSpacing: "2px" }}>EVENTS</div><div style={{ display: "flex", fontSize: "28px", fontWeight: 900, color: "#065f46" }}>{d.intel.event_count}</div></div>}
        {d.intel.avg_dupr != null && <div style={{ display: "flex", flexDirection: "column", background: "#f0fdf4", borderRadius: "10px", padding: "12px 18px" }}><div style={{ display: "flex", fontSize: "12px", color: "#065f46", fontWeight: 700, letterSpacing: "2px" }}>AVG RATING</div><div style={{ display: "flex", fontSize: "28px", fontWeight: 900, color: "#065f46" }}>{d.intel.avg_dupr.toFixed(2)}</div></div>}
        {d.intel.total_live_dupr > 0 && <div style={{ display: "flex", flexDirection: "column", background: "#f0fdf4", borderRadius: "10px", padding: "12px 18px" }}><div style={{ display: "flex", fontSize: "12px", color: "#065f46", fontWeight: 700, letterSpacing: "2px" }}>VERIFIED</div><div style={{ display: "flex", fontSize: "28px", fontWeight: 900, color: "#065f46" }}>{d.intel.total_live_dupr}</div></div>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #0a0a0a", paddingTop: "14px" }}>
        <div style={{ display: "flex", fontSize: "16px", fontWeight: 700, color: "#0a0a0a", letterSpacing: "3px" }}>PICKLERADAR.APP</div>
        {d.t.entry_fee != null && <div style={{ display: "flex", fontSize: "20px", fontWeight: 900, color: "#065f46" }}>${d.t.entry_fee}</div>}
      </div>
    </div>
  );
}

// 2. Newspaper — masthead + bylines
function Style_newspaper({ d }: { d: CardData }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#fafaf5", padding: "40px 56px", fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "4px solid #0a0a0a", paddingBottom: "12px" }}>
        <div style={{ display: "flex", fontSize: "44px", fontWeight: 900, color: "#0a0a0a", letterSpacing: "-1px" }}>The PickleRadar</div>
        <div style={{ display: "flex", fontSize: "14px", color: "#6b7280", letterSpacing: "2px", fontStyle: "italic" }}>HOUSTON · TOURNAMENT INTELLIGENCE</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: "32px", flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", fontSize: "13px", color: "#9ca3af", letterSpacing: "4px", fontStyle: "italic", marginBottom: "8px" }}>{d.dateRange.toUpperCase()} · {d.t.location_name.toUpperCase()}</div>
        <div style={{ display: "flex", fontSize: d.t.name.length > 40 ? "58px" : "72px", fontWeight: 900, color: "#0a0a0a", lineHeight: 0.95, letterSpacing: "-2px", maxWidth: "1080px" }}>{d.t.name}</div>
      </div>
      <div style={{ display: "flex", borderTop: "1px solid #0a0a0a", paddingTop: "16px", gap: "32px" }}>
        {d.intel.total_registered > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "11px", color: "#6b7280", letterSpacing: "2px" }}>REGISTERED</div><div style={{ display: "flex", fontSize: "24px", fontWeight: 900, color: "#0a0a0a" }}>{d.intel.total_registered}</div></div>}
        {d.intel.event_count > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "11px", color: "#6b7280", letterSpacing: "2px" }}>EVENTS</div><div style={{ display: "flex", fontSize: "24px", fontWeight: 900, color: "#0a0a0a" }}>{d.intel.event_count}</div></div>}
        {d.intel.avg_dupr != null && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "11px", color: "#6b7280", letterSpacing: "2px" }}>AVG RATING</div><div style={{ display: "flex", fontSize: "24px", fontWeight: 900, color: "#0a0a0a" }}>{d.intel.avg_dupr.toFixed(2)}</div></div>}
        <div style={{ display: "flex", marginLeft: "auto", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: "13px", color: "#6b7280", letterSpacing: "2px", fontStyle: "italic" }}>pickleradar.app</div>
        </div>
      </div>
    </div>
  );
}

// 3. Dark Bold — high contrast
function Style_dark_bold({ d }: { d: CardData }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0a0a0a", padding: "56px 64px", fontFamily: "system-ui, sans-serif", color: "white" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", fontSize: "24px" }}>🏓</div>
          <div style={{ display: "flex", fontSize: "18px", fontWeight: 900, color: "#10b981", letterSpacing: "3px" }}>PICKLERADAR</div>
        </div>
        {d.urgency && <div style={{ display: "flex", fontSize: "14px", fontWeight: 800, color: "#fca5a5", background: "rgba(239,68,68,0.15)", padding: "6px 14px", borderRadius: "999px", letterSpacing: "1px" }}>{d.urgency}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", height: "4px", background: "#10b981", width: "60px", marginBottom: "20px" }}>{""}</div>
        <div style={{ display: "flex", fontSize: d.t.name.length > 40 ? "56px" : "72px", fontWeight: 900, color: "white", lineHeight: 1.0, letterSpacing: "-2px", maxWidth: "1050px" }}>{d.t.name}</div>
        <div style={{ display: "flex", alignItems: "center", marginTop: "20px", gap: "14px" }}>
          <div style={{ display: "flex", fontSize: "24px", color: "#10b981", fontWeight: 800 }}>{d.dateRange}</div>
          <div style={{ display: "flex", fontSize: "24px", color: "#374151" }}>·</div>
          <div style={{ display: "flex", fontSize: "24px", color: "#9ca3af", fontWeight: 600 }}>{d.t.location_name}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "32px" }}>
          {d.intel.total_registered > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", color: "#6b7280", letterSpacing: "2px", fontWeight: 700 }}>REGISTERED</div><div style={{ display: "flex", fontSize: "28px", fontWeight: 900, color: "white" }}>{d.intel.total_registered}</div></div>}
          {d.intel.avg_dupr != null && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", color: "#6b7280", letterSpacing: "2px", fontWeight: 700 }}>AVG RATING</div><div style={{ display: "flex", fontSize: "28px", fontWeight: 900, color: "#10b981" }}>{d.intel.avg_dupr.toFixed(2)}</div></div>}
          {d.intel.total_live_dupr > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", color: "#6b7280", letterSpacing: "2px", fontWeight: 700 }}>VERIFIED</div><div style={{ display: "flex", fontSize: "28px", fontWeight: 900, color: "#10b981" }}>{d.intel.total_live_dupr}</div></div>}
        </div>
        <div style={{ display: "flex", fontSize: "14px", color: "#6b7280", letterSpacing: "3px", fontWeight: 700 }}>PICKLERADAR.APP</div>
      </div>
    </div>
  );
}

// 4. Scoreboard — sports broadcast
function Style_scoreboard({ d }: { d: CardData }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0f172a", fontFamily: "system-ui, sans-serif", color: "white" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e293b", padding: "24px 48px", borderBottom: "4px solid #d4af37" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", fontSize: "26px" }}>🏓</div>
          <div style={{ display: "flex", fontSize: "16px", fontWeight: 900, color: "#d4af37", letterSpacing: "4px" }}>PICKLERADAR · LIVE</div>
        </div>
        <div style={{ display: "flex", fontSize: "13px", color: "#94a3b8", letterSpacing: "3px", fontWeight: 700 }}>{d.dateRange.toUpperCase()}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: "40px 48px", flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", fontSize: "13px", color: "#64748b", letterSpacing: "3px", fontWeight: 700, marginBottom: "12px" }}>TOURNAMENT</div>
        <div style={{ display: "flex", fontSize: d.t.name.length > 40 ? "52px" : "64px", fontWeight: 900, color: "white", lineHeight: 1.0, letterSpacing: "-1.5px", maxWidth: "1050px" }}>{d.t.name}</div>
        <div style={{ display: "flex", fontSize: "20px", color: "#94a3b8", marginTop: "12px", fontWeight: 600 }}>{d.t.location_name}</div>
      </div>
      <div style={{ display: "flex", background: "#1e293b", padding: "20px 48px", gap: "40px", borderTop: "2px solid #334155" }}>
        {d.intel.total_registered > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "11px", color: "#64748b", letterSpacing: "2px", fontWeight: 700 }}>REG</div><div style={{ display: "flex", fontSize: "26px", fontWeight: 900, color: "#d4af37" }}>{d.intel.total_registered}</div></div>}
        {d.intel.event_count > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "11px", color: "#64748b", letterSpacing: "2px", fontWeight: 700 }}>EVENTS</div><div style={{ display: "flex", fontSize: "26px", fontWeight: 900, color: "white" }}>{d.intel.event_count}</div></div>}
        {d.intel.avg_dupr != null && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "11px", color: "#64748b", letterSpacing: "2px", fontWeight: 700 }}>AVG RATING</div><div style={{ display: "flex", fontSize: "26px", fontWeight: 900, color: "white" }}>{d.intel.avg_dupr.toFixed(2)}</div></div>}
        <div style={{ display: "flex", marginLeft: "auto", alignItems: "center", fontSize: "13px", color: "#475569", letterSpacing: "3px", fontWeight: 700 }}>PICKLERADAR.APP</div>
      </div>
    </div>
  );
}

// 5. Data Forward — stats are the hero
function Style_data({ d }: { d: CardData }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#FFFDF7", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "55%", padding: "48px 56px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", fontSize: "22px" }}>🏓</div>
          <div style={{ display: "flex", fontSize: "16px", fontWeight: 900, color: "#065f46", letterSpacing: "3px" }}>PICKLERADAR</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: "13px", color: "#9ca3af", letterSpacing: "3px", fontWeight: 700, marginBottom: "10px" }}>{d.dateRange.toUpperCase()}</div>
          <div style={{ display: "flex", fontSize: d.t.name.length > 35 ? "44px" : "54px", fontWeight: 900, color: "#0a0a0a", lineHeight: 1.0, letterSpacing: "-1.5px" }}>{d.t.name}</div>
          <div style={{ display: "flex", fontSize: "20px", color: "#6b7280", marginTop: "12px", fontWeight: 600 }}>{d.t.location_name}</div>
        </div>
        <div style={{ display: "flex", fontSize: "13px", color: "#0a0a0a", letterSpacing: "3px", fontWeight: 800 }}>PICKLERADAR.APP</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", width: "45%", background: "#065f46", padding: "48px 56px", justifyContent: "center", gap: "28px", color: "white" }}>
        {d.intel.total_registered > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "13px", color: "rgba(255,255,255,0.6)", letterSpacing: "2px", fontWeight: 700 }}>REGISTERED</div><div style={{ display: "flex", fontSize: "56px", fontWeight: 900, lineHeight: 1.0, marginTop: "4px" }}>{d.intel.total_registered}</div></div>}
        {d.intel.avg_dupr != null && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "13px", color: "rgba(255,255,255,0.6)", letterSpacing: "2px", fontWeight: 700 }}>AVG RATING</div><div style={{ display: "flex", fontSize: "56px", fontWeight: 900, lineHeight: 1.0, marginTop: "4px" }}>{d.intel.avg_dupr.toFixed(2)}</div></div>}
        {d.intel.total_live_dupr > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "13px", color: "rgba(255,255,255,0.6)", letterSpacing: "2px", fontWeight: 700 }}>VERIFIED RATINGS</div><div style={{ display: "flex", fontSize: "56px", fontWeight: 900, lineHeight: 1.0, marginTop: "4px" }}>{d.intel.total_live_dupr}</div></div>}
      </div>
    </div>
  );
}

// 6. Minimal Centered — premium calm
function Style_minimal({ d }: { d: CardData }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", background: "#FFFDF7", padding: "60px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ display: "flex", fontSize: "22px" }}>🏓</div>
        <div style={{ display: "flex", fontSize: "16px", fontWeight: 900, color: "#065f46", letterSpacing: "4px" }}>PICKLERADAR</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ display: "flex", fontSize: "13px", color: "#9ca3af", letterSpacing: "5px", fontWeight: 700 }}>{d.dateRange.toUpperCase()}</div>
        <div style={{ display: "flex", width: "40px", height: "2px", background: "#065f46", margin: "24px 0" }}>{""}</div>
        <div style={{ display: "flex", fontSize: d.t.name.length > 40 ? "48px" : "58px", fontWeight: 900, color: "#0a0a0a", lineHeight: 1.05, letterSpacing: "-1.5px", maxWidth: "950px", textAlign: "center" }}>{d.t.name}</div>
        <div style={{ display: "flex", fontSize: "20px", color: "#6b7280", marginTop: "20px", fontWeight: 600 }}>{d.t.location_name}</div>
      </div>
      <div style={{ display: "flex", gap: "40px" }}>
        {d.intel.total_registered > 0 && <div style={{ display: "flex", fontSize: "14px", color: "#6b7280", fontWeight: 700, letterSpacing: "2px" }}>{d.intel.total_registered} REGISTERED</div>}
        {d.intel.event_count > 0 && <div style={{ display: "flex", fontSize: "14px", color: "#6b7280", fontWeight: 700, letterSpacing: "2px" }}>{d.intel.event_count} EVENTS</div>}
        {d.intel.avg_dupr != null && <div style={{ display: "flex", fontSize: "14px", color: "#6b7280", fontWeight: 700, letterSpacing: "2px" }}>AVG RATING {d.intel.avg_dupr.toFixed(2)}</div>}
      </div>
    </div>
  );
}

// 7. Color Block — Mondrian-style hero block
function Style_block({ d }: { d: CardData }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#FFFDF7", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "65%", background: "#0a0a0a", padding: "56px 56px", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", fontSize: "22px" }}>🏓</div>
          <div style={{ display: "flex", fontSize: "16px", fontWeight: 900, color: "#FFFDF7", letterSpacing: "4px" }}>PICKLERADAR</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: d.t.name.length > 35 ? "48px" : "60px", fontWeight: 900, color: "white", lineHeight: 1.0, letterSpacing: "-1.5px" }}>{d.t.name}</div>
          <div style={{ display: "flex", fontSize: "20px", color: "#9ca3af", marginTop: "16px", fontWeight: 600 }}>{d.t.location_name}</div>
        </div>
        <div style={{ display: "flex", fontSize: "13px", color: "#6b7280", letterSpacing: "3px", fontWeight: 700 }}>PICKLERADAR.APP</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", width: "35%", padding: "56px 40px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", background: "#d4af37", padding: "20px 24px", borderRadius: "12px" }}>
          <div style={{ display: "flex", fontSize: "12px", color: "#0a0a0a", letterSpacing: "2px", fontWeight: 800 }}>WHEN</div>
          <div style={{ display: "flex", fontSize: "24px", fontWeight: 900, color: "#0a0a0a", marginTop: "4px" }}>{d.dateRange}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {d.intel.total_registered > 0 && <div style={{ display: "flex", flexDirection: "column", background: "#065f46", padding: "16px 20px", borderRadius: "12px", color: "white" }}><div style={{ display: "flex", fontSize: "11px", letterSpacing: "2px", fontWeight: 800, opacity: 0.7 }}>REGISTERED</div><div style={{ display: "flex", fontSize: "32px", fontWeight: 900 }}>{d.intel.total_registered}</div></div>}
          {d.intel.avg_dupr != null && <div style={{ display: "flex", flexDirection: "column", background: "#065f46", padding: "16px 20px", borderRadius: "12px", color: "white" }}><div style={{ display: "flex", fontSize: "11px", letterSpacing: "2px", fontWeight: 800, opacity: 0.7 }}>AVG RATING</div><div style={{ display: "flex", fontSize: "32px", fontWeight: 900 }}>{d.intel.avg_dupr.toFixed(2)}</div></div>}
        </div>
      </div>
    </div>
  );
}

// 8. Stenciled — bold sport-stencil headline
function Style_stencil({ d }: { d: CardData }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFDF7", padding: "0", fontFamily: "Impact, 'Helvetica Neue', sans-serif" }}>
      <div style={{ display: "flex", background: "#0a0a0a", padding: "16px 56px", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: "16px", fontWeight: 900, color: "#FFFDF7", letterSpacing: "6px" }}>PICKLERADAR · HOUSTON</div>
        <div style={{ display: "flex", fontSize: "14px", color: "#FFFDF7", letterSpacing: "3px", opacity: 0.7 }}>{d.dateRange.toUpperCase()}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: "48px 56px", flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: d.t.name.length > 30 ? "88px" : "108px", fontWeight: 900, color: "#0a0a0a", lineHeight: 0.9, letterSpacing: "-3px", textTransform: "uppercase" }}>{d.t.name}</div>
        </div>
        <div style={{ display: "flex", marginTop: "20px", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", fontSize: "22px", color: "#065f46", fontWeight: 900, letterSpacing: "1px" }}>{d.t.location_name.toUpperCase()}</div>
        </div>
      </div>
      <div style={{ display: "flex", background: "#065f46", padding: "20px 56px", justifyContent: "space-between", alignItems: "center", color: "white", borderTop: "8px solid #d4af37" }}>
        <div style={{ display: "flex", gap: "32px" }}>
          {d.intel.total_registered > 0 && <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}><div style={{ display: "flex", fontSize: "32px", fontWeight: 900 }}>{d.intel.total_registered}</div><div style={{ display: "flex", fontSize: "13px", letterSpacing: "2px", opacity: 0.8 }}>REG</div></div>}
          {d.intel.event_count > 0 && <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}><div style={{ display: "flex", fontSize: "32px", fontWeight: 900 }}>{d.intel.event_count}</div><div style={{ display: "flex", fontSize: "13px", letterSpacing: "2px", opacity: 0.8 }}>EVENTS</div></div>}
          {d.intel.avg_dupr != null && <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}><div style={{ display: "flex", fontSize: "32px", fontWeight: 900 }}>{d.intel.avg_dupr.toFixed(2)}</div><div style={{ display: "flex", fontSize: "13px", letterSpacing: "2px", opacity: 0.8 }}>AVG RATING</div></div>}
        </div>
        <div style={{ display: "flex", fontSize: "16px", letterSpacing: "4px", fontWeight: 900 }}>PICKLERADAR.APP</div>
      </div>
    </div>
  );
}

// 9. HYBRID — Stencil bars + Block asymmetric bottom
function Style_hybrid({ d }: { d: CardData }) {
  // Contextual urgency block — show whatever is most attention-worthy
  let badgeLabel = "ENTRY";
  let badgeValue: string = d.t.entry_fee != null ? `$${d.t.entry_fee}` : "FREE";
  let badgeBg = "#d4af37";
  let badgeText = "#0a0a0a";

  if (d.urgency && d.urgency.includes("CLOSED")) {
    badgeLabel = "REGISTRATION";
    badgeValue = "CLOSED";
    badgeBg = "#1a1a1a";
    badgeText = "#9ca3af";
  } else if (d.urgency && d.urgency.includes("h")) {
    badgeLabel = "HURRY";
    badgeValue = d.urgency.toUpperCase();
    badgeBg = "#dc2626";
    badgeText = "#FFFDF7";
  } else if (d.urgency) {
    badgeLabel = "CLOSES";
    badgeValue = d.urgency.replace("Closes in ", "IN ").toUpperCase();
    badgeBg = "#d4af37";
    badgeText = "#0a0a0a";
  }

  const nameLen = d.t.name.length;
  const nameSize = nameLen > 50 ? "48px" : nameLen > 36 ? "58px" : nameLen > 24 ? "72px" : "84px";

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFDF7", fontFamily: "system-ui, sans-serif" }}>

      {/* Top bar — brand + date */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0a0a", padding: "16px 56px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", fontSize: "20px" }}>🏓</div>
          <div style={{ display: "flex", fontSize: "16px", fontWeight: 900, color: "#FFFDF7", letterSpacing: "6px" }}>PICKLERADAR · HOUSTON</div>
        </div>
        <div style={{ display: "flex", fontSize: "14px", color: "#d4af37", letterSpacing: "4px", fontWeight: 800 }}>{d.dateRange.toUpperCase()}</div>
      </div>

      {/* Hero zone — name + venue (natural case, Block-style) */}
      <div style={{ display: "flex", flexDirection: "column", padding: "44px 56px 32px", flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", fontSize: nameSize, fontWeight: 900, color: "#0a0a0a", lineHeight: 1.0, letterSpacing: "-1.5px" }}>
          {d.t.name}
        </div>
        <div style={{ display: "flex", marginTop: "16px", alignItems: "center", gap: "14px" }}>
          <div style={{ display: "flex", fontSize: "22px", color: "#065f46", fontWeight: 700 }}>📍 {d.t.location_name}</div>
        </div>
      </div>

      {/* Bottom — split blocks: dark green intel + contextual gold/red badge */}
      <div style={{ display: "flex", borderTop: "8px solid #d4af37" }}>
        {/* Left: dark green intel */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, background: "#065f46", padding: "20px 56px", color: "white" }}>
          <div style={{ display: "flex", gap: "36px", alignItems: "center" }}>
            {d.intel.total_registered > 0 && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: "11px", letterSpacing: "3px", fontWeight: 800, opacity: 0.7 }}>REGISTERED</div>
                <div style={{ display: "flex", fontSize: "34px", fontWeight: 900, lineHeight: 1.0, marginTop: "2px" }}>{d.intel.total_registered}</div>
              </div>
            )}
            {d.intel.event_count > 0 && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: "11px", letterSpacing: "3px", fontWeight: 800, opacity: 0.7 }}>EVENTS</div>
                <div style={{ display: "flex", fontSize: "34px", fontWeight: 900, lineHeight: 1.0, marginTop: "2px" }}>{d.intel.event_count}</div>
              </div>
            )}
            {d.intel.avg_dupr != null && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: "11px", letterSpacing: "3px", fontWeight: 800, opacity: 0.7 }}>AVG RATING</div>
                <div style={{ display: "flex", fontSize: "34px", fontWeight: 900, lineHeight: 1.0, marginTop: "2px" }}>{d.intel.avg_dupr.toFixed(2)}</div>
              </div>
            )}
            {d.intel.total_live_dupr > 0 && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: "11px", letterSpacing: "3px", fontWeight: 800, opacity: 0.7 }}>LIVE</div>
                <div style={{ display: "flex", fontSize: "34px", fontWeight: 900, lineHeight: 1.0, marginTop: "2px" }}>{d.intel.total_live_dupr}</div>
              </div>
            )}
          </div>
        </div>
        {/* Right: contextual gold/red/dark badge */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", width: "280px", background: badgeBg, padding: "20px 32px" }}>
          <div style={{ display: "flex", fontSize: "11px", letterSpacing: "3px", fontWeight: 800, color: badgeText, opacity: 0.7 }}>{badgeLabel}</div>
          <div style={{ display: "flex", fontSize: badgeValue.length > 10 ? "22px" : "32px", fontWeight: 900, color: badgeText, lineHeight: 1.0, marginTop: "4px" }}>{badgeValue}</div>
        </div>
      </div>
    </div>
  );
}

// 10. RADAR — cream, real brand type, giant radar watermark fills the void
function Style_radar({ d }: { d: CardData }) {
  const badge = contextBadge(d);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFDF7", fontFamily: "Jakarta" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0a0a", padding: "20px 56px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logoMark(34)} width={34} height={34} alt="" />
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 800, color: "#FFFDF7", letterSpacing: "5px" }}>PICKLERADAR</div>
          <div style={{ display: "flex", fontSize: "20px", color: "#d4af37" }}>·</div>
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 700, color: "#d4af37", letterSpacing: "4px" }}>HOUSTON</div>
        </div>
        <div style={{ display: "flex", fontSize: "16px", color: "#d4af37", letterSpacing: "4px", fontWeight: 700 }}>{d.dateRange.toUpperCase()}</div>
      </div>

      {/* Hero with oversized radar watermark bleeding off the right */}
      <div style={{ display: "flex", position: "relative", flex: 1, padding: "0" }}>
        <img src={logoMark(620)} width={620} height={620} alt="" style={{ position: "absolute", top: "-70px", right: "-150px", opacity: 0.06 }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 56px" }}>
          <div style={{ display: "flex", fontSize: headlineSize(d.t.name), fontWeight: 800, color: "#0a0a0a", lineHeight: 0.98, letterSpacing: "-2px", maxWidth: "980px" }}>{d.t.name}</div>
          <div style={{ display: "flex", width: "56px", height: "5px", background: "#d4af37", borderRadius: "3px", margin: "26px 0 18px" }} />
          <div style={{ display: "flex", fontSize: "26px", color: "#065f46", fontWeight: 700 }}>{d.t.location_name}</div>
        </div>
      </div>

      {/* Bottom intel + badge */}
      <div style={{ display: "flex", borderTop: "8px solid #d4af37" }}>
        <div style={{ display: "flex", alignItems: "center", flex: 1, background: "#065f46", padding: "22px 56px", gap: "44px", color: "white" }}>
          {d.intel.total_registered > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>REGISTERED</div><div style={{ display: "flex", fontSize: "38px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.total_registered}</div></div>}
          {d.intel.event_count > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>EVENTS</div><div style={{ display: "flex", fontSize: "38px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.event_count}</div></div>}
          {d.intel.avg_dupr != null && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>AVG RATING</div><div style={{ display: "flex", fontSize: "38px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.avg_dupr.toFixed(2)}</div></div>}
          {d.intel.total_live_dupr > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>LIVE DUPR</div><div style={{ display: "flex", fontSize: "38px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.total_live_dupr}</div></div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "300px", background: badge.bg, padding: "22px 36px" }}>
          <div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, color: badge.fg, opacity: 0.7 }}>{badge.label}</div>
          <div style={{ display: "flex", fontSize: badge.value.length > 9 ? "26px" : "36px", fontWeight: 800, color: badge.fg, lineHeight: 1.0, marginTop: "4px" }}>{badge.value}</div>
        </div>
      </div>
    </div>
  );
}

// 11. SPOTLIGHT — dark, high-contrast; stands out against white feed chrome
function Style_spotlight({ d }: { d: CardData }) {
  const badge = contextBadge(d);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0a0a0a", padding: "52px 60px", fontFamily: "Jakarta", color: "#FFFDF7", position: "relative" }}>
      <img src={logoMark(560)} width={560} height={560} alt="" style={{ position: "absolute", top: "60px", right: "-140px", opacity: 0.08 }} />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logoMark(36)} width={36} height={36} alt="" />
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 800, color: "#FFFDF7", letterSpacing: "5px" }}>PICKLERADAR</div>
        </div>
        {d.urgency && <div style={{ display: "flex", fontSize: "15px", fontWeight: 800, color: d.urgency.includes("CLOSED") ? "#9ca3af" : "#fca5a5", background: d.urgency.includes("CLOSED") ? "rgba(255,255,255,0.06)" : "rgba(239,68,68,0.16)", padding: "8px 16px", borderRadius: "999px", letterSpacing: "1px" }}>{d.urgency.toUpperCase()}</div>}
      </div>
      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", width: "64px", height: "6px", background: "#d4af37", borderRadius: "3px", marginBottom: "22px" }} />
        <div style={{ display: "flex", fontSize: headlineSize(d.t.name), fontWeight: 800, color: "#FFFDF7", lineHeight: 0.98, letterSpacing: "-2px", maxWidth: "1000px" }}>{d.t.name}</div>
        <div style={{ display: "flex", alignItems: "center", marginTop: "22px", gap: "14px" }}>
          <div style={{ display: "flex", fontSize: "24px", color: "#d4af37", fontWeight: 700 }}>{d.dateRange}</div>
          <div style={{ display: "flex", fontSize: "24px", color: "#3f3f46" }}>·</div>
          <div style={{ display: "flex", fontSize: "24px", color: "#a1a1aa", fontWeight: 600 }}>{d.t.location_name}</div>
        </div>
      </div>
      {/* Stats */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "44px" }}>
          {d.intel.total_registered > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", color: "#71717a", letterSpacing: "3px", fontWeight: 700 }}>REGISTERED</div><div style={{ display: "flex", fontSize: "40px", fontWeight: 800, color: "#FFFDF7", lineHeight: 1.0 }}>{d.intel.total_registered}</div></div>}
          {d.intel.event_count > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", color: "#71717a", letterSpacing: "3px", fontWeight: 700 }}>EVENTS</div><div style={{ display: "flex", fontSize: "40px", fontWeight: 800, color: "#FFFDF7", lineHeight: 1.0 }}>{d.intel.event_count}</div></div>}
          {d.intel.avg_dupr != null && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", color: "#71717a", letterSpacing: "3px", fontWeight: 700 }}>AVG RATING</div><div style={{ display: "flex", fontSize: "40px", fontWeight: 800, color: "#d4af37", lineHeight: 1.0 }}>{d.intel.avg_dupr.toFixed(2)}</div></div>}
          {d.intel.total_live_dupr > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", color: "#71717a", letterSpacing: "3px", fontWeight: 700 }}>LIVE DUPR</div><div style={{ display: "flex", fontSize: "40px", fontWeight: 800, color: "#10b981", lineHeight: 1.0 }}>{d.intel.total_live_dupr}</div></div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: "12px", color: "#71717a", letterSpacing: "3px", fontWeight: 700 }}>{badge.label}</div>
          <div style={{ display: "flex", fontSize: "26px", fontWeight: 800, color: badge.bg === "#dc2626" ? "#fca5a5" : "#d4af37", lineHeight: 1.0, marginTop: "4px" }}>{badge.value}</div>
        </div>
      </div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");
  const style = searchParams.get("style") || "radar";

  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const d = await fetchData(id);
  if (!d) return new Response("Not found", { status: 404 });

  const map: Record<string, React.ReactElement> = {
    radar: <Style_radar d={d} />,
    spotlight: <Style_spotlight d={d} />,
    editorial: <Style_editorial d={d} />,
    newspaper: <Style_newspaper d={d} />,
    "dark-bold": <Style_dark_bold d={d} />,
    scoreboard: <Style_scoreboard d={d} />,
    data: <Style_data d={d} />,
    minimal: <Style_minimal d={d} />,
    block: <Style_block d={d} />,
    stencil: <Style_stencil d={d} />,
    hybrid: <Style_hybrid d={d} />,
  };

  const [semiBold, bold, extraBold] = await Promise.all([fontSemiBold, fontBold, fontExtraBold]);

  return new ImageResponse(map[style] ?? map.radar, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Jakarta", data: semiBold, weight: 600, style: "normal" },
      { name: "Jakarta", data: bold, weight: 700, style: "normal" },
      { name: "Jakarta", data: extraBold, weight: 800, style: "normal" },
    ],
  });
}
