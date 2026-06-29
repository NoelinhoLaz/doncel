"use server";

export interface NominatimResult {
  osmId: string;
  osmType: string;
  displayName: string;
  lat: number;
  lng: number;
  type: string;
  category: string;
  country: string | null;
  state: string | null;
  city: string | null;
  fullAddress: string;
  boundingbox: [string, string, string, string] | null;
}

export async function searchNominatim(query: string): Promise<NominatimResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&accept-language=es`;
    const res = await fetch(url, {
      headers: { "User-Agent": "GroomySaas_TravelApp_Contact/dev@noellazueng.com" },
    });

    if (!res.ok) return [];

    const data = await res.json();

    return (data || []).map((item: any) => ({
      osmId: item.osm_id?.toString(),
      osmType: item.osm_type,
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type || "",
      category: item.category || "",
      country: item.address?.country || null,
      state: item.address?.state || null,
      city: item.address?.city || item.address?.town || item.address?.village || null,
      fullAddress: item.display_name,
      boundingbox: item.boundingbox?.length === 4 ? item.boundingbox : null,
    }));
  } catch {
    return [];
  }
}
