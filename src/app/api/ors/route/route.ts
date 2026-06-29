import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { profile, coordinates } = body as {
    profile: "foot-walking" | "driving-car";
    coordinates: [number, number][];
  };

  if (!profile || !coordinates || coordinates.length < 2) {
    return NextResponse.json({ error: "profile and coordinates (min 2) required" }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ORS_API_KEY not configured" }, { status: 500 });
  }

  const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ coordinates }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json({ error: text }, { status: resp.status });
  }

  const data = await resp.json();
  const coords: [number, number][] =
    data?.features?.[0]?.geometry?.coordinates?.map(([lng, lat]: [number, number]) => [lat, lng]) ?? [];

  return NextResponse.json({ polyline: coords });
}
