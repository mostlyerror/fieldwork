import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId");
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  if (!API_KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask":
          "displayName,formattedAddress,location",
      },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "lookup failed" }, { status: 502 });
  }

  const data = await res.json();

  return NextResponse.json({
    placeId,
    name: data.displayName?.text ?? "",
    address: data.formattedAddress ?? "",
    lat: data.location?.latitude ?? null,
    lng: data.location?.longitude ?? null,
  });
}
