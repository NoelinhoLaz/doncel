import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

async function proxyImage(photoName: string): Promise<NextResponse> {
  const encodedPath = photoName.split("/").map(encodeURIComponent).join("/");
  const metaUrl = `https://places.googleapis.com/v1/${encodedPath}/media?key=${API_KEY}&maxWidthPx=400&skipHttpRedirect=true`;
  const metaRes = await fetch(metaUrl, { cache: "no-store" });
  if (!metaRes.ok) throw new Error(`meta fetch failed: ${metaRes.status}`);
  const meta = await metaRes.json().catch(() => null);
  const photoUri = meta?.photoUri;
  if (!photoUri) throw new Error("no photoUri");
  const imgRes = await fetch(photoUri, { cache: "force-cache" });
  if (!imgRes.ok) throw new Error(`img fetch failed: ${imgRes.status}`);
  const buffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  return new NextResponse(buffer, {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=86400" },
  });
}

async function getFreshPhotoName(placeId: string, idx = 0): Promise<string> {
  const url = `https://places.googleapis.com/v1/places/${placeId}?fields=photos&key=${API_KEY}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`place fetch failed: ${res.status}`);
  const data = await res.json();
  const photos: any[] = data?.photos ?? [];
  if (!photos.length) throw new Error("no photos for place");
  return photos[Math.min(idx, photos.length - 1)].name;
}

export async function GET(request: NextRequest) {
  if (!API_KEY) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const params = request.nextUrl.searchParams;
  const photoName = params.get("name");
  const placeId = params.get("place_id");
  const idx = Number(params.get("idx") ?? "0");

  try {
    // Modo 1: place_id → siempre fresco
    if (placeId) {
      const freshName = await getFreshPhotoName(placeId, idx);
      return await proxyImage(freshName);
    }

    // Modo 2: photo name guardado → intentar directo, si falla extraer place_id del name
    if (photoName) {
      try {
        return await proxyImage(photoName);
      } catch {
        // El photo name caducó — extraer place_id del resource name
        // formato: places/{place_id}/photos/{photo_reference}
        const match = photoName.match(/^places\/([^/]+)\/photos\//);
        if (match) {
          const freshName = await getFreshPhotoName(match[1], idx);
          return await proxyImage(freshName);
        }
        throw new Error("cannot recover place_id from photo name");
      }
    }

    return NextResponse.json({ error: "name or place_id param required" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch photo" }, { status: 500 });
  }
}
