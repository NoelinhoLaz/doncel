import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

export async function GET(request: NextRequest) {
  if (!API_KEY) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const placeId = request.nextUrl.searchParams.get("place_id");
  if (!placeId) return NextResponse.json({ error: "place_id required" }, { status: 400 });

  try {
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?key=${API_KEY}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "X-Goog-FieldMask": "rating,userRatingCount" },
    });
    if (!res.ok) throw new Error(`places fetch failed: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(
      { rating: data.rating ?? null, userRatingCount: data.userRatingCount ?? null },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
