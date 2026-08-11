import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { cleanEventName } from "@/lib/event-name";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Brand font (Plus Jakarta Sans) — Satori ignores fontWeight unless real font
// files are embedded, so without these the card falls back to a limp default
// sans. Read off disk on the Node runtime; outputFileTracingIncludes in
// next.config.ts keeps the TTFs in the deployed bundle.
const fontDir = path.join(process.cwd(), "src/app/api/og/fonts");
const fontSemiBold = readFile(path.join(fontDir, "PlusJakartaSans-600.ttf"));
const fontBold = readFile(path.join(fontDir, "PlusJakartaSans-700.ttf"));
const fontExtraBold = readFile(path.join(fontDir, "PlusJakartaSans-800.ttf"));

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
  venue_photo_url: string | null;
}

interface Intel {
  event_count: number;
  total_registered: number;
  total_live_dupr: number;
  max_sandbagger_pct: number | null;
  avg_dupr: number | null;
}

type Zone = "in" | "below" | "above";

const ZONE_FILL: Record<Zone, string> = { in: "#1f9d57", below: "#aeb6bc", above: "#e0483b" };

// Classify a rating against a bracket's skill window (mirrors lib/field-intel).
function classifyZone(rating: number, min: number | null, max: number | null): Zone {
  const EPS = 0.05;
  if (min != null && rating < min - EPS) return "below";
  if (max != null && rating > max + EPS) return "above";
  return "in";
}

interface CardData {
  t: TournamentRow;
  intel: Intel;
  dateRange: string;
  urgency: string | null;
  hasSandbagger: boolean;
  // Field strip: every rated registrant as one zone-colored square (sorted).
  strip: { rating: number; zone: Zone }[];
  zoneCounts: { in: number; below: number; above: number };
  // Set when the card is scoped to a single bracket (?bracket=<eventId>):
  // intel + strip cover only that event, and the card leads with its name.
  bracket: { name: string; window: string | null } | null;
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

async function fetchData(id: string, needStrip: boolean, bracketId: string | null): Promise<CardData | null> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name, date_start, date_end, location_name, entry_fee, registration_close_date, logo_url, venue_photo_url")
    .eq("id", id)
    .maybeSingle();

  if (!tournament) return null;

  const { data: allEvents } = await supabase
    .from("tournament_events")
    .select("id, name, registered_count, avg_dupr, sandbagger_pct, skill_level_min, skill_level_max")
    .eq("tournament_id", id);

  // An unknown bracket id degrades to the tournament-wide card rather than 404 —
  // a stale share link should still unfurl.
  const bracketEvent = bracketId ? (allEvents ?? []).find((e) => e.id === bracketId) ?? null : null;
  const events = bracketEvent ? [bracketEvent] : allEvents;

  const eventIds = events?.map((e) => e.id) ?? [];
  const windowOf = new Map<string, { min: number | null; max: number | null }>(
    (events ?? []).map((e) => [e.id as string, { min: e.skill_level_min as number | null, max: e.skill_level_max as number | null }]),
  );

  // Pull every registrant's effective rating (live enrichment ?? listed) and
  // classify each against its bracket window → the field strip. Only the strip
  // styles need this; other styles take the cheap live-count path instead.
  const strip: { rating: number; zone: Zone }[] = [];
  let totalLiveDupr = 0;
  if (eventIds.length > 0 && needStrip) {
    const { data: rows } = await supabase
      .from("event_players")
      .select("event_id, dupr_rating, enriched_dupr, partner_name, partner_dupr_rating, partner_enriched_dupr")
      .in("event_id", eventIds);
    for (const r of rows ?? []) {
      const win = windowOf.get(r.event_id as string) ?? { min: null, max: null };
      if (r.enriched_dupr != null) totalLiveDupr++;
      if (r.partner_enriched_dupr != null) totalLiveDupr++;
      const a = (r.enriched_dupr as number | null) ?? (r.dupr_rating as number | null);
      if (a != null) strip.push({ rating: a, zone: classifyZone(a, win.min, win.max) });
      const hasPartner = r.partner_name != null && (r.partner_dupr_rating != null || r.partner_enriched_dupr != null);
      const b = (r.partner_enriched_dupr as number | null) ?? (r.partner_dupr_rating as number | null);
      if (hasPartner && b != null) strip.push({ rating: b, zone: classifyZone(b, win.min, win.max) });
    }
  } else if (eventIds.length > 0) {
    const { count } = await supabase
      .from("event_players")
      .select("id", { count: "exact", head: true })
      .in("event_id", eventIds)
      .not("enriched_dupr", "is", null);
    totalLiveDupr = count ?? 0;
  }
  strip.sort((x, y) => x.rating - y.rating);
  const zoneCounts = {
    in: strip.filter((s) => s.zone === "in").length,
    below: strip.filter((s) => s.zone === "below").length,
    above: strip.filter((s) => s.zone === "above").length,
  };

  const event_count = events?.length ?? 0;
  const total_registered = events?.reduce((s, e) => s + (e.registered_count as number || 0), 0) ?? 0;
  const sandbaggerPcts = (events ?? []).map((e) => e.sandbagger_pct as number | null).filter((p): p is number => p != null && p > 0);
  const max_sandbagger_pct = sandbaggerPcts.length > 0 ? Math.max(...sandbaggerPcts) : null;
  const avgDuprs = (events ?? []).map((e) => e.avg_dupr as number | null).filter((d): d is number => d != null);
  const avg_dupr = avgDuprs.length > 0 ? avgDuprs.reduce((a, b) => a + b, 0) / avgDuprs.length : null;

  const t = tournament as TournamentRow;
  const g1 = (v: number) => v.toFixed(1);
  const bMin = bracketEvent?.skill_level_min as number | null | undefined;
  const bMax = bracketEvent?.skill_level_max as number | null | undefined;
  const win = bracketEvent
    ? bMin != null && bMax != null
      ? `${g1(bMin)}–${g1(bMax)}`
      : bMax != null
        ? `${g1(bMax)} & under`
        : bMin != null
          ? `${g1(bMin)}+`
          : null
    : null;
  return {
    t,
    intel: { event_count, total_registered, total_live_dupr: totalLiveDupr, max_sandbagger_pct, avg_dupr },
    dateRange: formatDateRange(t.date_start, t.date_end),
    urgency: urgencyText(t.registration_close_date),
    hasSandbagger: max_sandbagger_pct != null && max_sandbagger_pct > 0.2,
    strip,
    zoneCounts,
    bracket: bracketEvent
      ? {
          // The bundled Jakarta TTFs have no ≤ glyph (satori renders notdef),
          // so spell out cleanEventName's "≤3.0" as words.
          name: cleanEventName({
            name: (bracketEvent.name as string) ?? "Bracket",
            skill_level_min: bMin ?? null,
            skill_level_max: bMax ?? null,
          }).replace(/≤\s*([\d.]+)/g, "$1 & Under"),
          window: win,
        }
      : null,
  };
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
// Photo-hero: the venue photo full-bleed with a dark scrim and the same
// headline + stat treatment. Used by default whenever a venue photo exists —
// a real court photo stops the scroll in Facebook groups far better than the
// dark generated card.
function Style_photo({ d }: { d: CardData }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "52px 60px", fontFamily: "Jakarta", color: "#FFFDF7", position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={d.t.venue_photo_url!} width={1200} height={630} alt="" style={{ position: "absolute", top: 0, left: 0, width: "1200px", height: "630px", objectFit: "cover" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: "1200px", height: "630px", display: "flex", background: "linear-gradient(180deg, rgba(4,18,13,0.62) 0%, rgba(4,18,13,0.32) 38%, rgba(3,12,9,0.82) 76%, rgba(2,8,6,0.95) 100%)" }} />
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logoMark(36)} width={36} height={36} alt="" />
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 800, color: "#FFFDF7", letterSpacing: "5px" }}>PICKLERADAR</div>
        </div>
        {d.urgency && <div style={{ display: "flex", fontSize: "15px", fontWeight: 800, color: d.urgency.includes("CLOSED") ? "#e5e7eb" : "#fecaca", background: d.urgency.includes("CLOSED") ? "rgba(0,0,0,0.45)" : "rgba(220,38,38,0.7)", padding: "8px 16px", borderRadius: "999px", letterSpacing: "1px" }}>{d.urgency.toUpperCase()}</div>}
      </div>
      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", width: "64px", height: "6px", background: "#d4af37", borderRadius: "3px", marginBottom: "22px" }} />
        <div style={{ display: "flex", fontSize: headlineSize(d.t.name), fontWeight: 800, color: "#FFFDF7", lineHeight: 0.98, letterSpacing: "-2px", maxWidth: "1040px" }}>{d.t.name}</div>
        <div style={{ display: "flex", alignItems: "center", marginTop: "22px", gap: "14px" }}>
          <div style={{ display: "flex", fontSize: "24px", color: "#fbe08a", fontWeight: 700 }}>{d.dateRange}</div>
          <div style={{ display: "flex", fontSize: "24px", color: "#9ca3af" }}>·</div>
          <div style={{ display: "flex", fontSize: "24px", color: "#e5e7eb", fontWeight: 600 }}>{d.t.location_name}</div>
        </div>
      </div>
      {/* Stats */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "44px" }}>
          {d.intel.total_registered > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", color: "#cbd5d1", letterSpacing: "3px", fontWeight: 700 }}>REGISTERED</div><div style={{ display: "flex", fontSize: "40px", fontWeight: 800, color: "#FFFDF7", lineHeight: 1.0 }}>{d.intel.total_registered}</div></div>}
          {d.intel.event_count > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", color: "#cbd5d1", letterSpacing: "3px", fontWeight: 700 }}>EVENTS</div><div style={{ display: "flex", fontSize: "40px", fontWeight: 800, color: "#FFFDF7", lineHeight: 1.0 }}>{d.intel.event_count}</div></div>}
          {d.intel.avg_dupr != null && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", color: "#cbd5d1", letterSpacing: "3px", fontWeight: 700 }}>AVG RATING</div><div style={{ display: "flex", fontSize: "40px", fontWeight: 800, color: "#fbe08a", lineHeight: 1.0 }}>{d.intel.avg_dupr.toFixed(2)}</div></div>}
        </div>
        <div style={{ display: "flex", fontSize: "18px", fontWeight: 700, color: "#9af5c8" }}>pickleradar.app</div>
      </div>
    </div>
  );
}

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

// Field strip — every rated registrant as one zone-colored square, sorted, with
// the bracket window marked underneath. The in-app FieldStrip made shareable.
// `dark` swaps the window/label colors for use on a dark card.
function StripBand({ d, dark }: { d: CardData; dark: boolean }) {
  const strip = d.strip;
  const n = strip.length;
  if (n === 0) return null;
  const firstIn = strip.findIndex((s) => s.zone === "in");
  let lastIn = -1;
  for (let i = n - 1; i >= 0; i--) if (strip[i].zone === "in") { lastIn = i; break; }
  const muted = dark ? "#a1a1aa" : "#6b7280";
  const winColor = dark ? "rgba(212,175,55,0.85)" : "rgba(6,95,70,0.55)";
  const winLabel = dark ? "#d4af37" : "#065f46";

  const parts: string[] = [];
  if (d.zoneCounts.in > 0) parts.push(`${d.zoneCounts.in} in window`);
  if (d.zoneCounts.below > 0) parts.push(`${d.zoneCounts.below} below`);
  if (d.zoneCounts.above > 0) parts.push(`${d.zoneCounts.above} over`);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ display: "flex", gap: "2px", width: "100%" }}>
        {strip.map((s, i) => (
          <div key={i} style={{ display: "flex", flexGrow: 1, flexBasis: 0, minWidth: "3px", height: "30px", borderRadius: "3px", background: ZONE_FILL[s.zone], opacity: s.zone === "above" ? 0.92 : 1 }} />
        ))}
      </div>
      {firstIn >= 0 && (
        <div style={{ display: "flex", position: "relative", width: "100%", height: "16px", marginTop: "6px" }}>
          <div style={{ position: "absolute", top: 0, left: `${(firstIn / n) * 100}%`, width: `${((lastIn - firstIn + 1) / n) * 100}%`, height: "3px", borderRadius: "2px", background: winColor }} />
          <div style={{ display: "flex", position: "absolute", top: "5px", left: `${(firstIn / n) * 100}%`, fontSize: "11px", fontWeight: 800, letterSpacing: "2px", color: winLabel }}>WINDOW</div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "12px", fontSize: "16px", fontWeight: 700, color: muted }}>
        <div style={{ display: "flex", color: dark ? "#e9ece4" : "#0a0a0a" }}>{n} rated</div>
        {parts.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <div style={{ display: "flex", width: "10px", height: "10px", borderRadius: "3px", background: i === 0 ? ZONE_FILL.in : parts[i].includes("below") ? ZONE_FILL.below : ZONE_FILL.above }} />
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

// 12. SIGNATURE — cream Radar, but the field strip IS the hero (fills the void)
function Style_signature({ d }: { d: CardData }) {
  const badge = contextBadge(d);
  const hasStrip = d.strip.length > 0;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFDF7", fontFamily: "Jakarta" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0a0a", padding: "20px 56px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logoMark(34)} width={34} height={34} alt="" />
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 800, color: "#FFFDF7", letterSpacing: "5px" }}>PICKLERADAR</div>
          <div style={{ display: "flex", fontSize: "20px", color: "#d4af37" }}>·</div>
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 700, color: "#d4af37", letterSpacing: "4px" }}>HOUSTON</div>
        </div>
        <div style={{ display: "flex", fontSize: "16px", color: "#d4af37", letterSpacing: "4px", fontWeight: 700 }}>{d.dateRange.toUpperCase()}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "32px 56px", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: hasStrip ? "46px" : headlineSize(d.t.name), fontWeight: 800, color: "#0a0a0a", lineHeight: 0.98, letterSpacing: "-1.5px", maxWidth: "1080px" }}>{d.t.name}</div>
          <div style={{ display: "flex", fontSize: "22px", color: "#065f46", fontWeight: 700, marginTop: "10px" }}>{d.t.location_name}</div>
        </div>
        {hasStrip && <StripBand d={d} dark={false} />}
      </div>
      <div style={{ display: "flex", borderTop: "8px solid #d4af37" }}>
        <div style={{ display: "flex", alignItems: "center", flex: 1, background: "#065f46", padding: "20px 56px", gap: "44px", color: "white" }}>
          {d.intel.total_registered > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>REGISTERED</div><div style={{ display: "flex", fontSize: "34px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.total_registered}</div></div>}
          {d.intel.event_count > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>EVENTS</div><div style={{ display: "flex", fontSize: "34px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.event_count}</div></div>}
          {d.intel.avg_dupr != null && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>AVG RATING</div><div style={{ display: "flex", fontSize: "34px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.avg_dupr.toFixed(2)}</div></div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "300px", background: badge.bg, padding: "20px 36px" }}>
          <div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, color: badge.fg, opacity: 0.7 }}>{badge.label}</div>
          <div style={{ display: "flex", fontSize: badge.value.length > 9 ? "26px" : "36px", fontWeight: 800, color: badge.fg, lineHeight: 1.0, marginTop: "4px" }}>{badge.value}</div>
        </div>
      </div>
    </div>
  );
}

// 13. RADAR-DARK — dark feed-stopping bg + field strip + Radar's split bottom bar
function Style_radar_dark({ d }: { d: CardData }) {
  const badge = contextBadge(d);
  const hasStrip = d.strip.length > 0;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0c1109", fontFamily: "Jakarta", color: "#FFFDF7" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 56px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logoMark(34)} width={34} height={34} alt="" />
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 800, color: "#FFFDF7", letterSpacing: "5px" }}>PICKLERADAR</div>
          <div style={{ display: "flex", fontSize: "20px", color: "#d4af37" }}>·</div>
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 700, color: "#d4af37", letterSpacing: "4px" }}>HOUSTON</div>
        </div>
        <div style={{ display: "flex", fontSize: "16px", color: "#71717a", letterSpacing: "4px", fontWeight: 700 }}>{d.dateRange.toUpperCase()}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "20px 56px", gap: "20px" }}>
        <div style={{ display: "flex", width: "60px", height: "5px", background: "#d4af37", borderRadius: "3px" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: hasStrip ? "46px" : headlineSize(d.t.name), fontWeight: 800, color: "#FFFDF7", lineHeight: 0.98, letterSpacing: "-1.5px", maxWidth: "1080px" }}>{d.t.name}</div>
          <div style={{ display: "flex", fontSize: "22px", color: "#a1a1aa", fontWeight: 600, marginTop: "10px" }}>{d.t.location_name}</div>
        </div>
        {hasStrip && <StripBand d={d} dark={true} />}
      </div>
      <div style={{ display: "flex", borderTop: "8px solid #d4af37" }}>
        <div style={{ display: "flex", alignItems: "center", flex: 1, background: "#065f46", padding: "20px 56px", gap: "44px", color: "white" }}>
          {d.intel.total_registered > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>REGISTERED</div><div style={{ display: "flex", fontSize: "34px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.total_registered}</div></div>}
          {d.intel.event_count > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>EVENTS</div><div style={{ display: "flex", fontSize: "34px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.event_count}</div></div>}
          {d.intel.avg_dupr != null && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>AVG RATING</div><div style={{ display: "flex", fontSize: "34px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.avg_dupr.toFixed(2)}</div></div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "300px", background: badge.bg, padding: "20px 36px" }}>
          <div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, color: badge.fg, opacity: 0.7 }}>{badge.label}</div>
          <div style={{ display: "flex", fontSize: badge.value.length > 9 ? "26px" : "36px", fontWeight: 800, color: badge.fg, lineHeight: 1.0, marginTop: "4px" }}>{badge.value}</div>
        </div>
      </div>
    </div>
  );
}

// 14. BRACKET — Signature scoped to one bracket: the bracket name is the hero
// and the strip/stats cover only that field. What lands in a group chat when a
// player shares their own bracket.
function Style_bracket({ d }: { d: CardData }) {
  const b = d.bracket!;
  const badge = b.window
    ? { label: "SKILL WINDOW", value: b.window, bg: "#d4af37", fg: "#0a0a0a" }
    : contextBadge(d);
  const hasStrip = d.strip.length > 0;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFDF7", fontFamily: "Jakarta" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0a0a", padding: "20px 56px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logoMark(34)} width={34} height={34} alt="" />
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 800, color: "#FFFDF7", letterSpacing: "5px" }}>PICKLERADAR</div>
          <div style={{ display: "flex", fontSize: "20px", color: "#d4af37" }}>·</div>
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 700, color: "#d4af37", letterSpacing: "4px" }}>FIELD INTEL</div>
        </div>
        <div style={{ display: "flex", fontSize: "16px", color: "#d4af37", letterSpacing: "4px", fontWeight: 700 }}>{d.dateRange.toUpperCase()}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "32px 56px", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: "19px", fontWeight: 800, color: "#065f46", letterSpacing: "3px", textTransform: "uppercase" }}>{d.t.name}</div>
          <div style={{ display: "flex", fontSize: b.name.length > 34 ? "44px" : "58px", fontWeight: 800, color: "#0a0a0a", lineHeight: 0.98, letterSpacing: "-1.5px", maxWidth: "1080px", marginTop: "10px" }}>{b.name}</div>
          <div style={{ display: "flex", fontSize: "21px", color: "#6b7280", fontWeight: 700, marginTop: "10px" }}>{d.t.location_name}</div>
        </div>
        {hasStrip && <StripBand d={d} dark={false} />}
      </div>
      <div style={{ display: "flex", borderTop: "8px solid #d4af37" }}>
        <div style={{ display: "flex", alignItems: "center", flex: 1, background: "#065f46", padding: "20px 56px", gap: "44px", color: "white" }}>
          {d.intel.total_registered > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>REGISTERED</div><div style={{ display: "flex", fontSize: "34px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.total_registered}</div></div>}
          {d.intel.avg_dupr != null && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>AVG RATING</div><div style={{ display: "flex", fontSize: "34px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.avg_dupr.toFixed(2)}</div></div>}
          {d.intel.total_live_dupr > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, opacity: 0.65 }}>LIVE DUPR</div><div style={{ display: "flex", fontSize: "34px", fontWeight: 800, lineHeight: 1.0 }}>{d.intel.total_live_dupr}</div></div>}
          {d.zoneCounts.above > 0 && <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, color: "#fca5a5" }}>OVER CAP</div><div style={{ display: "flex", fontSize: "34px", fontWeight: 800, lineHeight: 1.0, color: "#fca5a5" }}>{d.zoneCounts.above}</div></div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "300px", background: badge.bg, padding: "20px 36px" }}>
          <div style={{ display: "flex", fontSize: "12px", letterSpacing: "3px", fontWeight: 700, color: badge.fg, opacity: 0.7 }}>{badge.label}</div>
          <div style={{ display: "flex", fontSize: badge.value.length > 9 ? "26px" : "36px", fontWeight: 800, color: badge.fg, lineHeight: 1.0, marginTop: "4px" }}>{badge.value}</div>
        </div>
      </div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");
  const explicitStyle = searchParams.get("style");
  const bracketId = searchParams.get("bracket");

  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const needStrip = bracketId != null || explicitStyle === "signature" || explicitStyle === "radar-dark";
  const d = await fetchData(id, needStrip, bracketId);
  if (!d) return new Response("Not found", { status: 404 });

  // Bracket-scoped cards get the bracket layout. Otherwise default to the
  // photo-hero card when we have a venue photo, falling back to the dark
  // branded card. An explicit ?style= always wins.
  const style = explicitStyle || (d.bracket ? "bracket" : d.t.venue_photo_url ? "photo" : "spotlight");

  const map: Record<string, React.ReactElement> = {
    radar: <Style_radar d={d} />,
    spotlight: <Style_spotlight d={d} />,
    signature: <Style_signature d={d} />,
    "radar-dark": <Style_radar_dark d={d} />,
    photo: <Style_photo d={d} />,
    ...(d.bracket && { bracket: <Style_bracket d={d} /> }),
  };

  const [semiBold, bold, extraBold] = await Promise.all([fontSemiBold, fontBold, fontExtraBold]);

  const png = new ImageResponse(map[style] ?? map.spotlight, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Jakarta", data: semiBold, weight: 600, style: "normal" },
      { name: "Jakarta", data: bold, weight: 700, style: "normal" },
      { name: "Jakarta", data: extraBold, weight: 800, style: "normal" },
    ],
  });

  // Chat apps (WhatsApp especially) refuse link-preview images over a few
  // hundred KB, and satori only emits PNG — photographic cards land ~800KB.
  // Transcode to JPEG so every card stays well under the limit, and let the
  // CDN absorb scraper traffic.
  const jpeg = await sharp(Buffer.from(await png.arrayBuffer()))
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
