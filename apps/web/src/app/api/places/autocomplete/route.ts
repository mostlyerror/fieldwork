import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input");
  if (!input || input.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  if (!API_KEY) {
    return NextResponse.json({ suggestions: [] }, { status: 503 });
  }

  const res = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
      },
      body: JSON.stringify({
        input,
        includedPrimaryTypes: ["establishment"],
      }),
    }
  );

  if (!res.ok) {
    return NextResponse.json({ suggestions: [] }, { status: 502 });
  }

  const data = await res.json();

  const suggestions = (data.suggestions ?? []).map(
    (s: {
      placePrediction?: {
        placeId: string;
        structuredFormat?: {
          mainText?: { text: string };
          secondaryText?: { text: string };
        };
      };
    }) => ({
      placeId: s.placePrediction?.placeId,
      mainText: s.placePrediction?.structuredFormat?.mainText?.text ?? "",
      secondaryText:
        s.placePrediction?.structuredFormat?.secondaryText?.text ?? "",
    })
  );

  return NextResponse.json({ suggestions });
}
