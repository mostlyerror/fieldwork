import { NextResponse } from "next/server";
import { searchOmni } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return NextResponse.json({ players: [], tournaments: [], venues: [] });
  }
  try {
    const results = await searchOmni(q);
    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  } catch {
    return NextResponse.json({ players: [], tournaments: [], venues: [] }, { status: 200 });
  }
}
