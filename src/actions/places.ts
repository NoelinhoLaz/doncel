"use server";

// Uses the Google Places API (New) via places.googleapis.com/v1.
// Requires the "Places API (New)" enabled in Google Cloud Console.
// If you still need the legacy service, enable the legacy Places API instead.

const NEW_API_BASE = "https://places.googleapis.com/v1";
const API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

export interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  types: string[];
}

export interface PlacePhoto {
  name: string;
  widthPx: number;
  heightPx: number;
}

export interface PlaceDetails {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  country: string | null;
  countryCode: string | null;
  adminAreaL1: string | null;
  adminAreaL2: string | null;
  locality: string | null;
  postalCode: string | null;
  types: string[];
  viewport: Record<string, any> | null;
  googleMapsUri: string | null;
  utcOffsetMinutes: number | null;
  photos: PlacePhoto[];
  rating: number | null;
  userRatingCount: number | null;
  googleMetadata: Record<string, unknown>;
}

function isKeyConfigured(): boolean {
  return Boolean(API_KEY) && API_KEY !== "TU_API_KEY_AQUI";
}

/**
 * Calls the legacy Places Autocomplete API (maps.googleapis.com).
 * Requires "Places API" enabled in Google Cloud Console (not "Places API New").
 * Runs server-side so the API key is never exposed to the browser.
 */
export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  if (!isKeyConfigured()) {
    console.warn("GOOGLE_PLACES_API_KEY not configured");
    return [];
  }

  try {
    const body = {
      input: query.trim(),
      languageCode: "es",
      includeQueryPredictions: false,
    };

    const res = await fetch(
      `${NEW_API_BASE}/places:autocomplete?key=${encodeURIComponent(API_KEY)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Places autocomplete error:", err);
      return [];
    }

    const json = await res.json();
    const suggestions: PlaceSuggestion[] = (json.suggestions || [])
      .filter((suggestion: any) => suggestion.placePrediction)
      .map((suggestion: any) => {
        const p = suggestion.placePrediction;
        const structured = p.structuredFormat || {};

        return {
          placeId: p.placeId,
          mainText: structured.mainText?.text || p.text?.text || "",
          secondaryText: structured.secondaryText?.text || "",
          fullText: p.text?.text || "",
          types: p.types || [],
        };
      });

    return suggestions;
  } catch (error: any) {
    console.error("Failed to search places:", error.message);
    return [];
  }
}

/**
 * Fetches full place details from the legacy Places Details API.
 * Requires "Places API" enabled in Google Cloud Console.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!placeId || !isKeyConfigured()) return null;

  try {
    const url = `${NEW_API_BASE}/places/${encodeURIComponent(placeId)}?languageCode=es&key=${encodeURIComponent(API_KEY)}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "Accept": "application/json",
        "X-Goog-FieldMask": "*"
      }
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Places details error:", err);
      return null;
    }

    const place = await res.json();

    // Parse address components into a flat map
    const components: Record<string, { long: string; short: string }> = {};
    const addressComponents = place.addressComponents || place.address_components || [];
    for (const comp of addressComponents) {
      for (const type of comp.types || []) {
        if (!components[type]) {
          components[type] = {
            long: comp.longText || comp.long_name || comp.longName || "",
            short: comp.shortText || comp.short_name || comp.shortName || "",
          };
        }
      }
    }

    const geoLocation =
      place.location ||
      place.geometry?.location ||
      place.geometry?.latLng ||
      place.geoCode?.location ||
      place.geoCode?.latLng ||
      place.geoCode?.coordinates ||
      null;

    const lat = geoLocation?.lat ?? geoLocation?.latitude ?? null;
    const lng = geoLocation?.lng ?? geoLocation?.longitude ?? null;

    let rawName = "";
    const dn = place.displayName;
    if (typeof dn === "string") {
      rawName = dn;
    } else if (dn?.text) {
      rawName = dn.text;
    } else if (place.name && !place.name.startsWith("places/")) {
      rawName = place.name;
    } else if (place.formatted_address) {
      rawName = place.formatted_address.split(",")[0]?.trim() || "";
    }

    const normalizedName =
      rawName || components["locality"]?.long ||
      components["administrative_area_level_3"]?.long ||
      components["administrative_area_level_2"]?.long ||
      components["administrative_area_level_1"]?.long ||
      place.formattedAddress ||
      place.address ||
      place.name || "";

    return {
      placeId,
      displayName: normalizedName,
      formattedAddress:
        place.formattedAddress ||
        place.formatted_address ||
        place.address ||
        (typeof place.displayName === "object" ? place.displayName?.text : place.displayName) ||
        rawName ||
        "",
      lat,
      lng,
      country: components["country"]?.long || null,
      countryCode: components["country"]?.short || null,
      adminAreaL1: components["administrative_area_level_1"]?.long || null,
      adminAreaL2: components["administrative_area_level_2"]?.long || null,
      locality:
        components["locality"]?.long ||
        components["administrative_area_level_3"]?.long ||
        null,
      postalCode: components["postal_code"]?.long || null,
      types: place.types || [],
      viewport: place.viewport || null,
      googleMapsUri: place.googleMapsUri || place.google_maps_uri || null,
      utcOffsetMinutes:
        place.utcOffsetMinutes ?? place.utc_offset_minutes ?? null,
      photos: (place.photos || []).slice(0, 4).map((ph: any) => ({
        name: ph.name,
        widthPx: ph.widthPx,
        heightPx: ph.heightPx,
      })),
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? null,
      googleMetadata: place,
    };
  } catch (error: any) {
    console.error("Failed to get place details:", error.message);
    return null;
  }
}
