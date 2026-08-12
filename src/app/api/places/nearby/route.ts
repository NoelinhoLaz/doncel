import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  if (!API_KEY) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const lat = request.nextUrl.searchParams.get("lat");
  const lng = request.nextUrl.searchParams.get("lng");
  const radius = request.nextUrl.searchParams.get("radius") || "5000";
  const tiposParam = request.nextUrl.searchParams.get("tipos") || request.nextUrl.searchParams.get("tipo") || "";
  const tipos = tiposParam.split(",").map(t => t.trim()).filter(Boolean);
  const ordenarPorDistancia = request.nextUrl.searchParams.get("orden") === "distancia";

  if (!lat || !lng) return NextResponse.json({ error: "lat y lng requeridos" }, { status: 400 });

  // rankPreference=DISTANCE de Google Places solo admite UN tipo incluido a la vez.
  // Con varios tipos seleccionados, ordenamos por distancia nosotros mismos abajo.
  const usarRankDistanceGoogle = ordenarPorDistancia && tipos.length <= 1;

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
      rankPreference: usarRankDistanceGoogle ? "DISTANCE" : "POPULARITY",
    };

    if (tipos.length > 0) body.includedTypes = tipos;

    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.internationalPhoneNumber,places.websiteUri,places.addressComponents",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`places nearby failed: ${res.status}`);
    const data = await res.json();

    const origenLat = parseFloat(lat);
    const origenLng = parseFloat(lng);

    let results = (data.places ?? []).map((p: any) => {
      const comps = p.addressComponents ?? [];
      const find = (type: string) => comps.find((c: any) => c.types?.includes(type))?.longText ?? "";
      const streetNumber = find("street_number");
      const route = find("route");
      const calle = [route, streetNumber].filter(Boolean).join(" ");
      const pLat = p.location?.latitude ?? null;
      const pLng = p.location?.longitude ?? null;

      return {
        nombre: p.displayName?.text ?? "",
        direccion: p.formattedAddress ?? "",
        calle: calle || undefined,
        cp: find("postal_code") || undefined,
        ciudad: find("locality") || find("postal_town") || undefined,
        provincia: find("administrative_area_level_2") || find("administrative_area_level_1") || undefined,
        lat: pLat,
        lng: pLng,
        distancia_m: pLat != null && pLng != null ? Math.round(distanciaMetros(origenLat, origenLng, pLat, pLng)) : null,
        tipos: p.types ?? [],
        rating: p.rating ?? null,
        num_ratings: p.userRatingCount ?? null,
        telefono: p.internationalPhoneNumber ?? null,
        web: p.websiteUri ?? null,
      };
    });

    if (ordenarPorDistancia && !usarRankDistanceGoogle) {
      results = results.sort((a: any, b: any) => (a.distancia_m ?? Infinity) - (b.distancia_m ?? Infinity));
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
