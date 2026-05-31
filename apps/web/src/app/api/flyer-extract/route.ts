import { NextRequest, NextResponse } from "next/server";
import { getUserRole } from "@/lib/auth";
import {
  extractFlyer,
  realFlyerClient,
  type FlyerExtractInput,
} from "@/lib/flyer-extract";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const role = await getUserRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: FlyerExtractInput;
  try {
    body = (await req.json()) as FlyerExtractInput;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.text && !body.imageBase64) {
    return NextResponse.json(
      { error: "text or imageBase64 required" },
      { status: 400 },
    );
  }
  // Fix E: body-size guard — return clean JSON error instead of unhandled 413
  if (body.imageBase64 && body.imageBase64.length > 4_000_000) {
    return NextResponse.json(
      { error: "image too large (max ~3 MB)" },
      { status: 413 },
    );
  }

  try {
    const extraction = await extractFlyer(
      { text: body.text ?? "", imageBase64: body.imageBase64, imageMediaType: body.imageMediaType },
      realFlyerClient,
    );
    return NextResponse.json({ extraction });
  } catch (err) {
    console.error("[flyer-extract]", err);
    return NextResponse.json({ error: "extraction failed" }, { status: 502 });
  }
}
