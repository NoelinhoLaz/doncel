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
  postcode: string | null;
  // Calle ya estructurada (road + house_number) desde item.address — usar esto en vez de
  // parsear displayName trocéandolo por comas: cuando el resultado es un POI con nombre
  // (colegio, instituto...), el primer trozo de displayName es el NOMBRE, no la calle.
  street: string | null;
  fullAddress: string;
  boundingbox: [string, string, string, string] | null;
  // Nombre del propio lugar/POI (ej: "Instituto de Educación Secundaria Senda Galiana"),
  // NO la localidad — solo para mostrar como título del resultado en el buscador.
  placeName: string | null;
}

export async function searchNominatim(query: string, opts?: { countrycodes?: string }): Promise<NominatimResult[]> {
  if (!query || query.trim().length < 2) return [];

  const countryParam = opts?.countrycodes ? `&countrycodes=${encodeURIComponent(opts.countrycodes)}` : "";
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&accept-language=es${countryParam}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "GroomySaas_TravelApp_Contact/dev@noellazueng.com" },
  });

  if (res.status === 429) throw new Error("NOMINATIM_RATE_LIMIT");
  if (!res.ok) return [];

  try {
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
      // Localidad real (nunca el nombre del POI) — city/town/village/etc. de item.address.
      city: item.address?.city || item.address?.town || item.address?.village || item.address?.suburb || item.address?.hamlet || item.address?.neighbourhood || null,
      postcode: item.address?.postcode || null,
      street: [item.address?.road, item.address?.house_number].filter(Boolean).join(" ") || null,
      fullAddress: item.display_name,
      boundingbox: item.boundingbox?.length === 4 ? item.boundingbox : null,
      placeName: item.name || null,
    }));
  } catch {
    return [];
  }
}
