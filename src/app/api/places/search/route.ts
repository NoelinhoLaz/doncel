import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

export async function GET(request: NextRequest) {
  if (!API_KEY) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const q = request.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.addressComponents",
      },
      body: JSON.stringify({ textQuery: q, languageCode: "es" }),
    });

    if (!res.ok) throw new Error(`places fetch failed: ${res.status}`);
    const data = await res.json();

    const results = (data.places ?? []).map((p: any) => {
      const comps = p.addressComponents ?? [];
      const find = (type: string) => comps.find((c: any) => c.types?.includes(type))?.longText ?? "";
      const streetNumber = find("street_number");
      const route = find("route");
      const calle = [route, streetNumber].filter(Boolean).join(" ");

      return {
        nombre: p.displayName?.text ?? "",
        direccion: p.formattedAddress ?? "",
        calle: calle || undefined,
        cp: find("postal_code") || undefined,
        ciudad: find("locality") || find("postal_town") || undefined,
        provincia: find("administrative_area_level_2") || find("administrative_area_level_1") || undefined,
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
      };
    });

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
