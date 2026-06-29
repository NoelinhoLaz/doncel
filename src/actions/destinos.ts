"use server";

import { getAgencyDbClient } from "@/lib/agencyDb";
import type { PlaceDetails } from "@/actions/places";

export async function getDestinos() {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("maestro_destinos")
      .select("*")
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error fetching destinos:", error);
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error("Failed to get destinos:", error.message);
    throw new Error(error.message || "Failed to fetch destinos");
  }
}

export async function createDestino(nombre: string) {
  try {
    const agencyDb = await getAgencyDbClient();
    const { data, error } = await agencyDb
      .from("maestro_destinos")
      .insert([{
        nombre: nombre,
        nombre_comercial: nombre,
        tipo_destino: "CIUDAD",
      }])
      .select()
      .single();

    if (error) {
      console.error("Error creating destino:", error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error("Failed to create destino:", error.message);
    throw new Error(error.message || "Failed to create destino");
  }
}

/**
 * Creates a destino in maestro_destinos from Google Place Details.
 * If a destino with the same google_place_id already exists for this agency,
 * it returns the existing record instead of inserting a duplicate.
 */
export async function createDestinoFromPlace(place: PlaceDetails) {
  try {
    const agencyDb = await getAgencyDbClient();

    // Check if a destino with this google_place_id already exists
    if (place.placeId) {
      const { data: existingRows, error: checkError } = await agencyDb
        .from("maestro_destinos")
        .select("*")
        .eq("google_place_id", place.placeId)
        .limit(1);

      if (checkError) throw checkError;
      if (existingRows && existingRows.length > 0) return existingRows[0];
    }

    // Determine tipo_destino from Google types
    const tipoDestino = inferTipoDestino(place.types);

    const metadata: any = place.googleMetadata || {};
    const metadataLocation =
      metadata?.geometry?.location ||
      metadata?.geoCode?.location ||
      metadata?.geoCode?.latLng ||
      metadata?.geoCode?.coordinates ||
      null;

    const lat = place.lat ?? metadataLocation?.lat ?? metadataLocation?.latitude ?? null;
    const lng = place.lng ?? metadataLocation?.lng ?? metadataLocation?.longitude ?? null;

    const record = {
      nombre: place.displayName,
      nombre_comercial: place.displayName,
      google_place_id: place.placeId,
      tipo_destino: tipoDestino.toUpperCase(),
      formatted_address: place.formattedAddress || metadata?.formatted_address || metadata?.formattedAddress || null,
      viewport: place.viewport || metadata?.viewport || metadata?.geometry?.viewport || null,
      google_maps_uri: place.googleMapsUri || metadata?.googleMapsUri || metadata?.google_maps_uri || null,
      utc_offset_minutes: place.utcOffsetMinutes ?? metadata?.utcOffsetMinutes ?? metadata?.utc_offset_minutes ?? null,
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      country: place.country || metadata?.country || null,
      admin_area_l1: place.adminAreaL1 || metadata?.administrative_area_level_1 || null,
      admin_area_l2: place.adminAreaL2 || metadata?.administrative_area_level_2 || null,
      locality: place.locality || metadata?.locality || null,
      postal_code: place.postalCode || metadata?.postal_code || null,
      continente: inferContinente(place.country || metadata?.country || null),
      google_metadata: place.googleMetadata ?? {},
    };

    const { data: insertedRows, error } = await agencyDb
      .from("maestro_destinos")
      .insert([record])
      .select()
      .limit(1);

    if (error) {
      console.error("Error creating destino from place:", error);
      throw error;
    }

    if (!insertedRows || insertedRows.length === 0) {
      throw new Error("No se pudo crear el destino");
    }

    return insertedRows[0];
  } catch (error: any) {
    console.error("Failed to create destino from place:", error.message);
    throw new Error(error.message || "Failed to create destino from place");
  }
}

function boundingboxToViewport(bb: [string, string, string, string] | null) {
  if (!bb) return null;
  const [south, north, west, east] = bb.map(Number);
  if ([south, north, west, east].some(isNaN)) return null;
  return {
    northeast: { lat: north, lng: east },
    southwest: { lat: south, lng: west },
  };
}

export async function createDestinoFromNominatim(result: {
  osmId: string;
  osmType: string;
  displayName: string;
  lat: number;
  lng: number;
  type: string;
  country: string | null;
  state: string | null;
  city: string | null;
  fullAddress: string;
  boundingbox: [string, string, string, string] | null;
}) {
  try {
    const agencyDb = await getAgencyDbClient();

    const { data: existing } = await agencyDb
      .from("maestro_destinos")
      .select("*")
      .eq("osm_type", result.osmType)
      .eq("osm_id", result.osmId)
      .limit(1);

    if (existing && existing.length > 0) return existing[0];

    const tipoDestino = inferTipoDestinoFromNominatim(result.type);
    const name = result.city || result.state || result.displayName.split(",")[0].trim();

    const record = {
      nombre: name,
      nombre_comercial: name,
      osm_id: result.osmId,
      osm_type: result.osmType,
      tipo_destino: tipoDestino.toUpperCase(),
      formatted_address: result.fullAddress,
      viewport: boundingboxToViewport(result.boundingbox),
      lat: result.lat != null ? Number(result.lat) : null,
      lng: result.lng != null ? Number(result.lng) : null,
      country: result.country,
      admin_area_l1: result.state,
      locality: result.city,
      continente: inferContinente(result.country),
    };

    const { data, error } = await agencyDb
      .from("maestro_destinos")
      .insert([record])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error("Failed to create destino from Nominatim:", error.message);
    throw new Error(error.message || "Failed to create destino from Nominatim");
  }
}

function inferTipoDestinoFromNominatim(nominatimType: string): string {
  switch (nominatimType) {
    case "country": return "PAIS";
    case "state": return "REGION";
    case "region": return "REGION";
    case "city": return "CIUDAD";
    case "town": return "CIUDAD";
    case "village": return "CIUDAD";
    case "hamlet": return "CIUDAD";
    case "municipality": return "CIUDAD";
    case "airport": return "AEROPUERTO";
    case "attraction": return "ATRACCION";
    case "hotel": return "HOTEL";
    default: return "CIUDAD";
  }
}

function inferTipoDestino(types: string[]): string {
  if (types.includes("country")) return "PAIS";
  if (types.includes("continent")) return "CONTINENTE";
  if (
    types.includes("locality") ||
    types.includes("administrative_area_level_3")
  )
    return "CIUDAD";
  if (
    types.includes("administrative_area_level_1") ||
    types.includes("administrative_area_level_2")
  )
    return "REGION";
  if (types.includes("airport")) return "AEROPUERTO";
  if (types.includes("tourist_attraction")) return "ATRACCION";
  return "CIUDAD";
}

function inferContinente(country: string | null): string | null {
  if (!country) return null;
  const europe = [
    "España",
    "Francia",
    "Italia",
    "Portugal",
    "Alemania",
    "Reino Unido",
    "Reino Unido de Gran Bretaña e Irlanda del Norte",
    "Andorra",
    "Bélgica",
    "Países Bajos",
    "Holanda",
    "Luxemburgo",
    "Suiza",
    "Austria",
    "Polonia",
    "Hungría",
    "Suecia",
    "Noruega",
    "Dinamarca",
    "Finlandia",
    "Rumania",
    "Bulgaria",
    "Grecia",
    "Turquía",
  ];
  if (europe.includes(country)) return "Europa";
  const america = ["Estados Unidos", "México", "Venezuela", "Argentina", "Colombia", "Brasil", "Chile", "Perú", "Uruguay"];
  if (america.includes(country)) return "América";
  const asia = ["India", "China", "Japón", "Corea del Sur", "Corea del Norte", "Rusia", "Turquía"];
  if (asia.includes(country)) return "Asia";
  const africa = ["Marruecos", "Argelia", "Egipto", "Sudáfrica"];
  if (africa.includes(country)) return "África";
  const oceania = ["Australia", "Nueva Zelanda"];
  if (oceania.includes(country)) return "Oceanía";
  return "Otros";
}

