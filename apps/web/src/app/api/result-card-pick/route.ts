import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Anonymous analytics ping: which result-card style a visitor downloaded or
// shared. Deliberately unauthenticated — it fires from a public results page —
// so it runs on the anon key, not the service role. RLS on result_card_picks
// grants exactly one thing to anon (INSERT), which is all this needs; reaching
// for the service-role key here would have handed an unauthenticated endpoint
// god-mode over the whole database if it ever grew a bug.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Mirrors STYLES in components/result-card-picker.tsx and the CHECK constraint
// on the table (migration 038) — three places, so reject early with a clear 400
// rather than surfacing a Postgres constraint error.
const STYLES = new Set(["dark", "editorial", "podium"]);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { eventId, playerId, style } = body;

  if (
    typeof eventId !== "string" ||
    typeof playerId !== "string" ||
    typeof style !== "string" ||
    !UUID.test(eventId) ||
    !UUID.test(playerId) ||
    !STYLES.has(style)
  ) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  const { error } = await supabase.from("result_card_picks").insert({
    event_id: eventId,
    player_id: playerId,
    style,
  });

  // Best-effort telemetry: a failed pick must never break the share flow, but
  // silently swallowing it would hide a broken policy or a dead table.
  if (error) console.error("[result-card-pick]", error.message);

  return NextResponse.json({ ok: true });
}
