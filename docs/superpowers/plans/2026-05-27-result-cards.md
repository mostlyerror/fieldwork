# Result Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate shareable tournament result cards (1080x1350 IG story images) with three visual styles and a style picker page, so medalists can share their placement on social media.

**Architecture:** Migration adds `placement` column to `event_players` + `result_card_picks` tracking table. Scraper extension parses medal data from PBB API and writes placements. Edge API route generates images via `next/og`. Result page at `/results/[eventId]/[playerId]` shows style picker + download/share. Tournament page gets a podium section linking to result pages.

**Tech Stack:** Next.js 15 App Router, next/og (ImageResponse), Supabase, Tailwind v4, TypeScript

---

### Task 1: Database Migration — placement + pick tracking

**Files:**
- Create: `supabase/migrations/018_placements_and_pick_tracking.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add placement to event_players (1=gold, 2=silver, 3=bronze)
alter table event_players add column if not exists placement smallint;

-- Track which result card style users download/share
create table if not exists result_card_picks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references tournament_events(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  style text not null,
  created_at timestamptz default now()
);

alter table result_card_picks enable row level security;
create policy "Public insert" on result_card_picks for insert with check (true);
create policy "Public read" on result_card_picks for select using (true);
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push --linked`
Expected: Migration 018 applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/018_placements_and_pick_tracking.sql
git commit -m "Add placement column and result_card_picks table"
```

---

### Task 2: Placement scraper — parse medal data from PBB API

**Files:**
- Create: `packages/scrapers/src/utils/placements.ts`
- Create: `packages/scrapers/test/placements.test.ts`
- Modify: `packages/scrapers/src/index.ts`

- [ ] **Step 1: Write tests for medal name parsing**

```typescript
// packages/scrapers/test/placements.test.ts
import { describe, it, expect } from "vitest";
import { parseMedalNames } from "../src/utils/placements.js";

describe("parseMedalNames", () => {
  it("parses doubles team from HTML br tag", () => {
    expect(parseMedalNames("Janet Kwon<br>Blanca Tejada")).toEqual([
      "Janet Kwon",
      "Blanca Tejada",
    ]);
  });

  it("parses singles player (no br tag)", () => {
    expect(parseMedalNames("John Smith")).toEqual(["John Smith"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseMedalNames("")).toEqual([]);
  });

  it("trims whitespace", () => {
    expect(parseMedalNames("  Lynn Cao <br> Tina Phan  ")).toEqual([
      "Lynn Cao",
      "Tina Phan",
    ]);
  });

  it("handles <br/> and <br /> variants", () => {
    expect(parseMedalNames("A Player<br/>B Player")).toEqual([
      "A Player",
      "B Player",
    ]);
    expect(parseMedalNames("A Player<br />B Player")).toEqual([
      "A Player",
      "B Player",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/scrapers && npx vitest run test/placements.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement placements module**

```typescript
// packages/scrapers/src/utils/placements.ts
import { supabase } from "./supabase.js";

const PBB_API = "https://pickleballtournaments.com/tournaments/api";

interface PbbEventWithMedals {
  activityId: string;
  title: string;
  status: { id: number };
  goldMedalTeam: string;
  silverMedalTeam: string;
  bronzeMedalTeam: string;
}

export function parseMedalNames(html: string): string[] {
  if (!html || !html.trim()) return [];
  return html
    .split(/<br\s*\/?>/i)
    .map((n) => n.trim())
    .filter(Boolean);
}

function nameMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function writePlacements(): Promise<number> {
  // Find tournaments with matches but no placements yet
  const today = new Date().toISOString().split("T")[0];
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, source_url")
    .eq("status", "active")
    .lte("date_end", today);

  if (!tournaments || tournaments.length === 0) return 0;

  let totalWritten = 0;

  for (const tournament of tournaments) {
    const slug = (tournament.source_url as string)
      .split("/tournaments/")[1]
      ?.replace(/\/.*$/, "");
    if (!slug) continue;

    // Check if this tournament already has placements
    const { data: existingPlacements } = await supabase
      .from("event_players")
      .select("id")
      .eq("placement", 1)
      .in(
        "event_id",
        (
          await supabase
            .from("tournament_events")
            .select("id")
            .eq("tournament_id", tournament.id)
        ).data?.map((e) => e.id) ?? [],
      )
      .limit(1);

    if (existingPlacements && existingPlacements.length > 0) continue;

    // Fetch event data from PBB
    const res = await fetch(`${PBB_API}/tourneyEvents?slug=${slug}`);
    if (!res.ok) continue;

    const body = await res.json();
    const pbbEvents: PbbEventWithMedals[] = [];
    for (const group of body.events ?? []) {
      for (const event of group.events ?? []) {
        pbbEvents.push(event);
      }
    }

    // Get our event mapping
    const { data: ourEvents } = await supabase
      .from("tournament_events")
      .select("id, source_event_id")
      .eq("tournament_id", tournament.id);

    const eventMap = new Map<string, string>();
    for (const e of ourEvents ?? []) {
      if (e.source_event_id) {
        eventMap.set(
          (e.source_event_id as string).toLowerCase(),
          e.id as string,
        );
      }
    }

    for (const pbbEvent of pbbEvents) {
      if (pbbEvent.status.id !== 3) continue; // not completed
      if (!pbbEvent.goldMedalTeam) continue;

      const eventId = eventMap.get(pbbEvent.activityId.toLowerCase());
      if (!eventId) continue;

      // Get event_players for this event
      const { data: players } = await supabase
        .from("event_players")
        .select("id, player_name, partner_name")
        .eq("event_id", eventId);

      if (!players) continue;

      const medals: { placement: number; names: string[] }[] = [
        { placement: 1, names: parseMedalNames(pbbEvent.goldMedalTeam) },
        { placement: 2, names: parseMedalNames(pbbEvent.silverMedalTeam) },
        { placement: 3, names: parseMedalNames(pbbEvent.bronzeMedalTeam) },
      ];

      for (const medal of medals) {
        if (medal.names.length === 0) continue;

        // Find the event_player row matching the medal names
        const matched = players.find((p) => {
          const playerName = p.player_name as string;
          const partnerName = p.partner_name as string | null;

          if (medal.names.length === 1) {
            return nameMatch(playerName, medal.names[0]);
          }
          // Doubles: both names must match (either order)
          const names = [playerName, partnerName].filter(Boolean) as string[];
          return (
            medal.names.every((mn) =>
              names.some((pn) => nameMatch(mn, pn)),
            ) && names.length >= medal.names.length
          );
        });

        if (matched) {
          const { error } = await supabase
            .from("event_players")
            .update({ placement: medal.placement })
            .eq("id", matched.id);

          if (!error) {
            totalWritten++;
            console.log(
              `[placements] ${medal.names.join(" / ")} → ${medal.placement === 1 ? "🥇" : medal.placement === 2 ? "🥈" : "🥉"} in ${pbbEvent.title}`,
            );
          }
        } else {
          console.log(
            `[placements] WARN: no match for ${medal.names.join(" / ")} in ${pbbEvent.title}`,
          );
        }
      }
    }
  }

  console.log(`[placements] Wrote ${totalWritten} placements`);
  return totalWritten;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/scrapers && npx vitest run test/placements.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Wire into scraper pipeline**

In `packages/scrapers/src/index.ts`, add import and call after live matches:

```typescript
import { writePlacements } from "./utils/placements.js";
```

Add after the live-matches block:

```typescript
  // Write placements for completed tournaments
  try {
    const placed = await writePlacements();
    if (placed > 0) {
      await sendDiscordAlert({
        title: "🏆 Placements recorded",
        description: `${placed} medalists written`,
      });
    }
  } catch (err) {
    console.error("[placements] Placement scrape failed:", err);
  }
```

- [ ] **Step 6: Commit**

```bash
git add packages/scrapers/src/utils/placements.ts packages/scrapers/test/placements.test.ts packages/scrapers/src/index.ts
git commit -m "Add placement scraper: parse medal data from PBB API"
```

---

### Task 3: Result card query function

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/queries.ts`

- [ ] **Step 1: Add ResultCardData type**

In `apps/web/src/lib/types.ts`, add before the `FieldStrengthFilter` type:

```typescript
export interface ResultCardData {
  playerName: string;
  partnerName: string | null;
  placement: number;
  dupr: number | null;
  partnerDupr: number | null;
  eventName: string;
  eventId: string;
  tournamentName: string;
  tournamentDate: string;
  venue: string;
  playerId: string;
  // For podium style — all medalists in this event
  goldTeam: string | null;
  silverTeam: string | null;
  bronzeTeam: string | null;
}
```

- [ ] **Step 2: Add query function**

In `apps/web/src/lib/queries.ts`, add:

```typescript
export async function getResultCardData(
  eventId: string,
  playerId: string,
): Promise<ResultCardData | null> {
  const { data: ep, error } = await supabase
    .from("event_players")
    .select("player_name, partner_name, placement, enriched_dupr, partner_enriched_dupr, dupr_rating, partner_dupr_rating, event_id, player_id")
    .eq("event_id", eventId)
    .eq("player_id", playerId)
    .not("placement", "is", null)
    .maybeSingle();

  if (error || !ep || !ep.placement) return null;

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

  // Get all medalists for podium style
  const { data: medalists } = await supabase
    .from("event_players")
    .select("player_name, partner_name, placement")
    .eq("event_id", eventId)
    .not("placement", "is", null)
    .order("placement", { ascending: true });

  function teamName(row: { player_name: string; partner_name: string | null }): string {
    return [row.player_name, row.partner_name].filter(Boolean).join(" & ");
  }

  const gold = medalists?.find((m) => m.placement === 1);
  const silver = medalists?.find((m) => m.placement === 2);
  const bronze = medalists?.find((m) => m.placement === 3);

  const dateStr = tournament.date_start === tournament.date_end
    ? new Date(tournament.date_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : `${new Date(tournament.date_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${new Date(tournament.date_end + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return {
    playerName: ep.player_name as string,
    partnerName: ep.partner_name as string | null,
    placement: ep.placement as number,
    dupr: (ep.enriched_dupr as number | null) ?? (ep.dupr_rating as number | null),
    partnerDupr: (ep.partner_enriched_dupr as number | null) ?? (ep.partner_dupr_rating as number | null),
    eventName: event.name as string,
    eventId,
    tournamentName: tournament.name as string,
    tournamentDate: dateStr,
    venue: tournament.location_name as string,
    playerId,
    goldTeam: gold ? teamName(gold as { player_name: string; partner_name: string | null }) : null,
    silverTeam: silver ? teamName(silver as { player_name: string; partner_name: string | null }) : null,
    bronzeTeam: bronze ? teamName(bronze as { player_name: string; partner_name: string | null }) : null,
  };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/queries.ts
git commit -m "Add ResultCardData type and query function"
```

---

### Task 4: Result card image API — three styles

**Files:**
- Create: `apps/web/src/app/api/result-card/route.tsx`

- [ ] **Step 1: Create the image generation route**

```typescript
// apps/web/src/app/api/result-card/route.tsx
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

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

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" } as Record<number, string>;
const PLACEMENT_LABEL = { 1: "GOLD MEDAL", 2: "SILVER MEDAL", 3: "BRONZE MEDAL" } as Record<number, string>;
const PLACEMENT_ORDINAL = { 1: "1ST PLACE", 2: "2ND PLACE", 3: "3RD PLACE" } as Record<number, string>;

function DarkStyle({ d }: { d: CardData }) {
  const names = [d.playerName, d.partnerName].filter(Boolean).join("\n& ");
  const duprText = [d.dupr, d.partnerDupr]
    .filter((r): r is number => r != null)
    .map((r) => r.toFixed(2))
    .join(" / ");

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(145deg, #065f46 0%, #064e3b 50%, #1a1a1a 100%)", padding: "60px 48px", fontFamily: "system-ui, sans-serif", color: "white" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <div style={{ fontSize: "80px" }}>{MEDAL[d.placement]}</div>
        <div style={{ fontSize: "16px", letterSpacing: "4px", textTransform: "uppercase" as const, color: "#d4af37", fontWeight: 800 }}>{PLACEMENT_LABEL[d.placement]}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" as const }}>
        <div style={{ fontSize: "44px", fontWeight: 900, lineHeight: 1.2, whiteSpace: "pre-line" as const }}>{names}</div>
        {duprText && <div style={{ fontSize: "20px", color: "rgba(255,255,255,0.5)", marginTop: "12px" }}>DUPR {duprText}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px" }}>
        <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" as const, letterSpacing: "2px" }}>{d.eventName}</div>
        <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "6px" }}>{d.tournamentName}</div>
        <div style={{ fontSize: "15px", color: "rgba(255,255,255,0.5)", marginTop: "4px" }}>{d.tournamentDate} · {d.venue}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", fontSize: "13px", color: "rgba(255,255,255,0.2)", letterSpacing: "3px" }}>PICKLERADAR.APP</div>
    </div>
  );
}

function EditorialStyle({ d }: { d: CardData }) {
  const names = [d.playerName, d.partnerName].filter(Boolean).join(" & ");
  const duprText = [d.dupr, d.partnerDupr]
    .filter((r): r is number => r != null)
    .map((r) => r.toFixed(2))
    .join(" / ");

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFDF7", padding: "60px 48px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ background: "#065f46", color: "white", fontSize: "13px", fontWeight: 800, padding: "6px 14px", borderRadius: "6px", letterSpacing: "3px" }}>{PLACEMENT_ORDINAL[d.placement]}</div>
        <div style={{ fontSize: "13px", color: "#9ca3af", letterSpacing: "2px", textTransform: "uppercase" as const }}>{d.eventName}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: "52px", fontWeight: 900, color: "#1a1a1a", lineHeight: 1.1 }}>{names}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ borderTop: "3px solid #1a1a1a", paddingTop: "20px" }}>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#1a1a1a" }}>{d.tournamentName}</div>
          <div style={{ fontSize: "16px", color: "#6b7280", marginTop: "6px" }}>{d.tournamentDate} · {d.venue}</div>
        </div>
        {duprText && (
          <div style={{ display: "flex", gap: "16px", marginTop: "20px" }}>
            <div style={{ background: "#f0fdf4", borderRadius: "12px", padding: "12px 20px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "11px", color: "#065f46", textTransform: "uppercase" as const, letterSpacing: "2px", fontWeight: 700 }}>DUPR</div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#065f46" }}>{duprText}</div>
            </div>
          </div>
        )}
      </div>
      <div style={{ fontSize: "13px", color: "#d1d5db", fontWeight: 700, letterSpacing: "3px" }}>PICKLERADAR.APP</div>
    </div>
  );
}

function PodiumStyle({ d }: { d: CardData }) {
  const names = [d.playerName, d.partnerName].filter(Boolean).join(" & ");
  const duprText = [d.dupr, d.partnerDupr]
    .filter((r): r is number => r != null)
    .map((r) => r.toFixed(2))
    .join(" / ");

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(180deg, #FFFDF7 0%, #f0fdf4 100%)", padding: "48px 40px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontSize: "13px", color: "#9ca3af", letterSpacing: "3px", textTransform: "uppercase" as const, fontWeight: 700 }}>{d.tournamentName}</div>
        <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>{d.eventName}</div>
      </div>
      {/* Podium */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "6px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "200px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#6b7280", textAlign: "center" as const, marginBottom: "8px" }}>{d.silverTeam || "—"}</div>
          <div style={{ background: "#d1d5db", width: "100%", height: "120px", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "36px", fontWeight: 900, color: "white" }}>2nd</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "220px" }}>
          <div style={{ fontSize: "16px", fontWeight: 900, color: "#1a1a1a", textAlign: "center" as const, marginBottom: "8px" }}>{d.goldTeam || "—"}</div>
          <div style={{ background: "#065f46", width: "100%", height: "170px", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "48px" }}>🥇</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "200px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#6b7280", textAlign: "center" as const, marginBottom: "8px" }}>{d.bronzeTeam || "—"}</div>
          <div style={{ background: "#ca8a04", width: "100%", height: "80px", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "36px", fontWeight: 900, color: "white" }}>3rd</span>
          </div>
        </div>
      </div>
      {/* Your result */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", border: "3px solid #065f46", borderRadius: "16px", padding: "20px", background: "white" }}>
        <div style={{ fontSize: "12px", color: "#065f46", textTransform: "uppercase" as const, letterSpacing: "3px", fontWeight: 800 }}>Your Result</div>
        <div style={{ fontSize: "36px", fontWeight: 900, color: "#065f46", marginTop: "4px" }}>{MEDAL[d.placement]} {PLACEMENT_ORDINAL[d.placement]}</div>
        <div style={{ fontSize: "20px", fontWeight: 700, color: "#1a1a1a", marginTop: "4px" }}>{names}</div>
        {duprText && <div style={{ fontSize: "15px", color: "#6b7280", marginTop: "4px" }}>DUPR {duprText}</div>}
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/result-card/route.tsx
git commit -m "Add result card image API with three styles"
```

---

### Task 5: Result page with style picker

**Files:**
- Create: `apps/web/src/app/results/[eventId]/[playerId]/page.tsx`
- Create: `apps/web/src/components/result-card-picker.tsx`

- [ ] **Step 1: Create the style picker client component**

```typescript
// apps/web/src/components/result-card-picker.tsx
"use client";

import { useState } from "react";

const STYLES = [
  { id: "dark", label: "Dark & Bold" },
  { id: "editorial", label: "Clean Editorial" },
  { id: "podium", label: "Podium" },
] as const;

export function ResultCardPicker({
  eventId,
  playerId,
}: {
  eventId: string;
  playerId: string;
}) {
  const [selected, setSelected] = useState<string>("editorial");
  const [copied, setCopied] = useState(false);

  const imageUrl = `/api/result-card?eventId=${eventId}&playerId=${playerId}&style=${selected}`;
  const pageUrl = typeof window !== "undefined"
    ? window.location.href
    : `https://pickleradar.app/results/${eventId}/${playerId}`;

  async function handleDownload() {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pickleradar-result-${selected}.png`;
    a.click();
    URL.revokeObjectURL(url);
    trackPick(selected);
  }

  async function handleShare() {
    trackPick(selected);
    if (navigator.share) {
      try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const file = new File([blob], "pickleradar-result.png", { type: "image/png" });
        await navigator.share({
          title: "My tournament result — PickleRadar",
          url: pageUrl,
          files: [file],
        });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function trackPick(style: string) {
    fetch("/api/result-card-pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, playerId, style }),
    }).catch(() => {});
  }

  return (
    <div>
      {/* Style picker */}
      <div className="flex gap-3 mb-6">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(s.id)}
            className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-bold transition ${
              selected === s.id
                ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="rounded-xl overflow-hidden shadow-lg border border-gray-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={selected}
          src={imageUrl}
          alt="Result card preview"
          className="w-full"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={handleDownload}
          className="flex-1 rounded-xl bg-emerald-700 px-6 py-4 text-lg font-bold text-white transition hover:bg-emerald-800"
        >
          Download Image
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 rounded-xl border-2 border-emerald-700 px-6 py-4 text-lg font-bold text-emerald-700 transition hover:bg-emerald-50"
        >
          {copied ? "Link Copied!" : "Share"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the result page**

```typescript
// apps/web/src/app/results/[eventId]/[playerId]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getResultCardData } from "@/lib/queries";
import { ResultCardPicker } from "@/components/result-card-picker";
import { ServerHeader } from "@/components/server-header";
import { getDefaultCity } from "@/lib/cities";
import Link from "next/link";

export const revalidate = 3600;

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" } as Record<number, string>;
const ORDINAL = { 1: "1st Place", 2: "2nd Place", 3: "3rd Place" } as Record<number, string>;

type PageProps = { params: Promise<{ eventId: string; playerId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventId, playerId } = await params;
  const data = await getResultCardData(eventId, playerId);
  if (!data) return { title: "Result Not Found" };

  const names = [data.playerName, data.partnerName].filter(Boolean).join(" & ");
  const title = `${MEDAL[data.placement]} ${names} — ${ORDINAL[data.placement]} at ${data.tournamentName}`;

  const ogImage = `https://pickleradar.app/api/result-card?eventId=${eventId}&playerId=${playerId}&style=editorial`;

  return {
    title: `${title} — PickleRadar`,
    description: `${names} placed ${ORDINAL[data.placement]} in ${data.eventName} at ${data.tournamentName}. View and share on PickleRadar.`,
    openGraph: {
      title,
      images: [{ url: ogImage, width: 1080, height: 1350 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [ogImage],
    },
  };
}

export default async function ResultPage({ params }: PageProps) {
  const { eventId, playerId } = await params;
  const data = await getResultCardData(eventId, playerId);
  if (!data) notFound();

  const city = getDefaultCity();
  const names = [data.playerName, data.partnerName].filter(Boolean).join(" & ");

  return (
    <div className="min-h-screen bg-background">
      <ServerHeader city={city} />
      <main className="mx-auto max-w-lg px-5 py-8">
        <Link
          href={`/${city.slug}`}
          className="mb-6 inline-flex items-center text-sm text-gray-400 hover:text-emerald-700"
        >
          &larr; Back
        </Link>

        <div className="text-center mb-8">
          <div className="text-5xl mb-2">{MEDAL[data.placement]}</div>
          <h1 className="text-2xl font-extrabold text-gray-900">{names}</h1>
          <p className="text-lg font-bold text-emerald-700 mt-1">{ORDINAL[data.placement]}</p>
          <p className="text-sm text-gray-500 mt-2">{data.eventName}</p>
          <p className="text-sm text-gray-400">{data.tournamentName} · {data.tournamentDate}</p>
        </div>

        <ResultCardPicker eventId={eventId} playerId={playerId} />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/results/[eventId]/[playerId]/page.tsx apps/web/src/components/result-card-picker.tsx
git commit -m "Add result page with style picker and download/share"
```

---

### Task 6: Pick tracking API route

**Files:**
- Create: `apps/web/src/app/api/result-card-pick/route.ts`

- [ ] **Step 1: Create the tracking endpoint**

```typescript
// apps/web/src/app/api/result-card-pick/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { eventId, playerId, style } = body;

  if (!eventId || !playerId || !style) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  await supabase.from("result_card_picks").insert({
    event_id: eventId,
    player_id: playerId,
    style,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/result-card-pick/route.ts
git commit -m "Add result card pick tracking endpoint"
```

---

### Task 7: Tournament page podium section

**Files:**
- Create: `apps/web/src/components/tournament-podium.tsx`
- Modify: `apps/web/src/app/[city]/tournaments/[id]/page.tsx`
- Modify: `apps/web/src/lib/queries.ts` (add placement data to event query)

- [ ] **Step 1: Add placements to event player query**

The existing `getTournamentEvents` query already fetches `event_players.*`. Since we added `placement` to the table, it's already included in `select("*")`. No query change needed — just need to expose it on the type.

In `apps/web/src/lib/types.ts`, add to `EventPlayer`:

```typescript
  placement: number | null;
```

- [ ] **Step 2: Map placement in the query**

In `apps/web/src/lib/queries.ts`, inside the `getTournamentEvents` player mapping loop, add `placement` to the `EventPlayer` construction:

```typescript
      placement: raw.placement as number | null,
```

(Add after the `partner_live_dupr_verified` line.)

- [ ] **Step 3: Create podium component**

```typescript
// apps/web/src/components/tournament-podium.tsx
import Link from "next/link";
import type { TournamentEvent } from "@/lib/types";
import { IntelSectionHeader } from "@/components/intel-section-header";

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" } as Record<number, string>;
const LABEL = { 1: "Gold", 2: "Silver", 3: "Bronze" } as Record<number, string>;

export function TournamentPodium({ events }: { events: TournamentEvent[] }) {
  const eventsWithPlacements = events.filter(
    (e) => e.players?.some((p) => p.placement != null),
  );

  if (eventsWithPlacements.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      <IntelSectionHeader title="Results" />
      <div className="divide-y divide-gray-100 bg-white">
        {eventsWithPlacements.map((event) => {
          const medalists = (event.players ?? [])
            .filter((p) => p.placement != null)
            .sort((a, b) => a.placement! - b.placement!);

          return (
            <div key={event.id} className="px-5 py-4">
              <h4 className="text-sm font-bold text-gray-900 mb-3">{event.name}</h4>
              <div className="flex flex-col gap-2">
                {medalists.map((p) => {
                  const names = [p.player_name, p.partner_name].filter(Boolean).join(" & ");
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-lg">{MEDAL[p.placement!]}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-gray-800">{names}</span>
                      </div>
                      {p.player_id && (
                        <Link
                          href={`/results/${event.id}/${p.player_id}`}
                          className="shrink-0 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          Share →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into tournament page**

In `apps/web/src/app/[city]/tournaments/[id]/page.tsx`:

Add import:
```typescript
import { TournamentPodium } from "@/components/tournament-podium";
```

Add after the LiveBracket section (before the related tournaments section):
```tsx
        {events.length > 0 && (
          <section className="mt-6">
            <TournamentPodium events={events} />
          </section>
        )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/tournament-podium.tsx apps/web/src/app/\[city\]/tournaments/\[id\]/page.tsx apps/web/src/lib/types.ts apps/web/src/lib/queries.ts
git commit -m "Add tournament podium section with share links to result cards"
```

---

### Task 8: End-to-end test with Life Time tournament data

**Files:** None (manual verification)

- [ ] **Step 1: Run placement scraper on existing data**

The Life Time tournament already has completed events in PBB. Run the placement writer:

```bash
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL apps/web/.env.local | cut -d= -f2) \
SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2) \
npx tsx packages/scrapers/src/run-placements.ts
```

(Create a quick runner script: `packages/scrapers/src/run-placements.ts`)

```typescript
import { writePlacements } from "./utils/placements.js";
writePlacements().then((n) => console.log(`Done: ${n} placements`)).catch(console.error);
```

Expected: Should write placements for the Life Time Women's Doubles event (gold: Janet Kwon & Blanca Tejada, silver: C C & Julie Jones, bronze: Martha Aguilera & vianey aguilera).

- [ ] **Step 2: Verify image generation**

Open in browser:
```
http://localhost:3000/api/result-card?eventId={EVENT_ID}&playerId={PLAYER_ID}&style=dark
http://localhost:3000/api/result-card?eventId={EVENT_ID}&playerId={PLAYER_ID}&style=editorial
http://localhost:3000/api/result-card?eventId={EVENT_ID}&playerId={PLAYER_ID}&style=podium
```

Expected: Three different style images render with correct data.

- [ ] **Step 3: Verify result page**

Open: `http://localhost:3000/results/{EVENT_ID}/{PLAYER_ID}`
Expected: Page shows placement, style picker with three thumbnails, download and share buttons work.

- [ ] **Step 4: Verify tournament podium**

Open the Life Time tournament page.
Expected: "Results" section appears with Gold/Silver/Bronze medalists and "Share →" links.

- [ ] **Step 5: Commit runner script**

```bash
git add packages/scrapers/src/run-placements.ts
git commit -m "Add placement runner script for testing"
```
