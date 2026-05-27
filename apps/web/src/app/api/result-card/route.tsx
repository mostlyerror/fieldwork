import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface CardData {
  playerName: string;
  partnerName: string | null;
  placement: number;
  dupr: number | null;
  partnerDupr: number | null;
  eventName: string;
  tournamentName: string;
  tournamentDate: string;
  venue: string;
  goldTeam: string | null;
  silverTeam: string | null;
  bronzeTeam: string | null;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const LABEL: Record<number, string> = { 1: "GOLD MEDAL", 2: "SILVER MEDAL", 3: "BRONZE MEDAL" };
const ORD: Record<number, string> = { 1: "1ST PLACE", 2: "2ND PLACE", 3: "3RD PLACE" };

function duprStr(d: CardData): string {
  return [d.dupr, d.partnerDupr].filter((r): r is number => r != null).map((r) => r.toFixed(2)).join(" / ");
}

function DarkStyle({ d }: { d: CardData }) {
  const names = [d.playerName, d.partnerName].filter(Boolean).join(" & ");
  const dr = duprStr(d);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(145deg, #065f46 0%, #064e3b 50%, #1a1a1a 100%)", padding: "60px 48px", fontFamily: "system-ui, sans-serif", color: "white" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontSize: "80px", display: "flex" }}>{MEDAL[d.placement]}</div>
        <div style={{ fontSize: "16px", letterSpacing: "4px", color: "#d4af37", fontWeight: 800, marginTop: "8px", display: "flex" }}>{LABEL[d.placement]}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontSize: "44px", fontWeight: 900, lineHeight: 1.2, textAlign: "center", display: "flex" }}>{names}</div>
        <div style={{ fontSize: "20px", color: "rgba(255,255,255,0.5)", marginTop: "12px", display: "flex" }}>{dr ? `DUPR ${dr}` : ""}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px" }}>
        <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", letterSpacing: "2px", display: "flex" }}>{d.eventName}</div>
        <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "6px", display: "flex" }}>{d.tournamentName}</div>
        <div style={{ fontSize: "15px", color: "rgba(255,255,255,0.5)", marginTop: "4px", display: "flex" }}>{d.tournamentDate} · {d.venue}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", fontSize: "13px", color: "rgba(255,255,255,0.2)", letterSpacing: "3px" }}>PICKLERADAR.APP</div>
    </div>
  );
}

function EditorialStyle({ d }: { d: CardData }) {
  const names = [d.playerName, d.partnerName].filter(Boolean).join(" & ");
  const dr = duprStr(d);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFDF7", padding: "60px 48px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ background: "#065f46", color: "white", fontSize: "13px", fontWeight: 800, padding: "6px 14px", borderRadius: "6px", letterSpacing: "3px", display: "flex" }}>{ORD[d.placement]}</div>
        <div style={{ fontSize: "13px", color: "#9ca3af", letterSpacing: "2px", display: "flex" }}>{d.eventName}</div>
      </div>
      <div style={{ display: "flex" }}>
        <div style={{ fontSize: "52px", fontWeight: 900, color: "#1a1a1a", lineHeight: 1.1, display: "flex" }}>{names}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", borderTop: "3px solid #1a1a1a", paddingTop: "20px" }}>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#1a1a1a", display: "flex" }}>{d.tournamentName}</div>
          <div style={{ fontSize: "16px", color: "#6b7280", marginTop: "6px", display: "flex" }}>{d.tournamentDate} · {d.venue}</div>
        </div>
        {dr ? (
          <div style={{ display: "flex", gap: "16px", marginTop: "20px" }}>
            <div style={{ background: "#f0fdf4", borderRadius: "12px", padding: "12px 20px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "11px", color: "#065f46", letterSpacing: "2px", fontWeight: 700, display: "flex" }}>DUPR</div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#065f46", display: "flex" }}>{dr}</div>
            </div>
          </div>
        ) : <div style={{ display: "flex" }} />}
      </div>
      <div style={{ display: "flex", fontSize: "13px", color: "#d1d5db", fontWeight: 700, letterSpacing: "3px" }}>PICKLERADAR.APP</div>
    </div>
  );
}

function PodiumStyle({ d }: { d: CardData }) {
  const names = [d.playerName, d.partnerName].filter(Boolean).join(" & ");
  const dr = duprStr(d);
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(180deg, #FFFDF7 0%, #f0fdf4 100%)", padding: "48px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontSize: "13px", color: "#9ca3af", letterSpacing: "3px", fontWeight: 700, display: "flex" }}>{d.tournamentName}</div>
        <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px", display: "flex" }}>{d.eventName}</div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "6px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "200px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#6b7280", textAlign: "center", marginBottom: "8px", display: "flex" }}>{d.silverTeam || "—"}</div>
          <div style={{ background: "#d1d5db", width: "100%", height: "120px", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "36px", fontWeight: 900, color: "white" }}>2nd</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "220px" }}>
          <div style={{ fontSize: "16px", fontWeight: 900, color: "#1a1a1a", textAlign: "center", marginBottom: "8px", display: "flex" }}>{d.goldTeam || "—"}</div>
          <div style={{ background: "#065f46", width: "100%", height: "170px", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "48px" }}>🥇</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "200px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#6b7280", textAlign: "center", marginBottom: "8px", display: "flex" }}>{d.bronzeTeam || "—"}</div>
          <div style={{ background: "#ca8a04", width: "100%", height: "80px", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "36px", fontWeight: 900, color: "white" }}>3rd</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", border: "3px solid #065f46", borderRadius: "16px", padding: "20px", background: "white" }}>
        <div style={{ fontSize: "12px", color: "#065f46", letterSpacing: "3px", fontWeight: 800, display: "flex" }}>Your Result</div>
        <div style={{ fontSize: "36px", fontWeight: 900, color: "#065f46", marginTop: "4px", display: "flex" }}>{MEDAL[d.placement]} {ORD[d.placement]}</div>
        <div style={{ fontSize: "20px", fontWeight: 700, color: "#1a1a1a", marginTop: "4px", display: "flex" }}>{names}</div>
        <div style={{ fontSize: "15px", color: "#6b7280", marginTop: "4px", display: "flex" }}>{dr ? `DUPR ${dr}` : ""}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", fontSize: "13px", color: "#d1d5db", fontWeight: 700, letterSpacing: "3px" }}>PICKLERADAR.APP</div>
    </div>
  );
}

async function fetchCardData(eventId: string, playerId: string): Promise<CardData | null> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: ep } = await supabase
    .from("event_players")
    .select("player_name, partner_name, placement, enriched_dupr, partner_enriched_dupr, dupr_rating, partner_dupr_rating")
    .eq("event_id", eventId)
    .eq("player_id", playerId)
    .not("placement", "is", null)
    .maybeSingle();

  if (!ep) return null;

  const { data: event } = await supabase
    .from("tournament_events")
    .select("name, tournament_id")
    .eq("id", eventId)
    .single();
  if (!event) return null;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name, date_start, date_end, location_name")
    .eq("id", event.tournament_id)
    .single();
  if (!tournament) return null;

  const { data: medalists } = await supabase
    .from("event_players")
    .select("player_name, partner_name, placement")
    .eq("event_id", eventId)
    .not("placement", "is", null)
    .order("placement", { ascending: true });

  const teamName = (r: Record<string, unknown>) =>
    [r.player_name, r.partner_name].filter(Boolean).join(" & ");

  const gold = medalists?.find((m) => m.placement === 1);
  const silver = medalists?.find((m) => m.placement === 2);
  const bronze = medalists?.find((m) => m.placement === 3);

  const ds = tournament.date_start as string;
  const de = tournament.date_end as string;
  const dateStr = ds === de
    ? new Date(ds + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : `${new Date(ds + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${new Date(de + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return {
    playerName: ep.player_name as string,
    partnerName: ep.partner_name as string | null,
    placement: ep.placement as number,
    dupr: (ep.enriched_dupr ?? ep.dupr_rating) as number | null,
    partnerDupr: (ep.partner_enriched_dupr ?? ep.partner_dupr_rating) as number | null,
    eventName: event.name as string,
    tournamentName: tournament.name as string,
    tournamentDate: dateStr,
    venue: tournament.location_name as string,
    goldTeam: gold ? teamName(gold as Record<string, unknown>) : null,
    silverTeam: silver ? teamName(silver as Record<string, unknown>) : null,
    bronzeTeam: bronze ? teamName(bronze as Record<string, unknown>) : null,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const eventId = searchParams.get("eventId");
  const playerId = searchParams.get("playerId");
  const style = searchParams.get("style") || "editorial";

  if (!eventId || !playerId) {
    return new Response("Missing eventId or playerId", { status: 400 });
  }

  const d = await fetchCardData(eventId, playerId);
  if (!d) {
    return new Response("No placement data found", { status: 404 });
  }

  const content =
    style === "dark" ? <DarkStyle d={d} /> :
    style === "podium" ? <PodiumStyle d={d} /> :
    <EditorialStyle d={d} />;

  return new ImageResponse(content, { width: 1080, height: 1350 });
}
