import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

export async function GET(request: NextRequest) {
  if (!API_KEY) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const lat = request.nextUrl.searchParams.get("lat");
  const lng = request.nextUrl.searchParams.get("lng");
  const radius = request.nextUrl.searchParams.get("radius") || "5000";
  const tipo = request.nextUrl.searchParams.get("tipo") || "";

  if (!lat || !lng) return NextResponse.json({ error: "lat y lng requeridos" }, { status: 400 });

  try {
    const body: Record<string, unknown> = {
      locationRestriction: {
        circle: {
          center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
          radius: parseFloat(radius),
        },
      },
      languageCode: "es",
      maxResultCount: 20,
    };

    if (tipo) body.includedTypes = [tipo];

    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.internationalPhoneNumber,places.websiteUri",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`places nearby failed: ${res.status}`);
    const data = await res.json();

    const results = (data.places ?? []).map((p: any) => ({
      nombre: p.displayName?.text ?? "",
      direccion: p.formattedAddress ?? "",
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      tipos: p.types ?? [],
      rating: p.rating ?? null,
      num_ratings: p.userRatingCount ?? null,
      telefono: p.internationalPhoneNumber ?? null,
      web: p.websiteUri ?? null,
    }));

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
