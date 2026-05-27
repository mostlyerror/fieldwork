import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
