import { config } from "./config.js";

export interface PlaceData {
  placeId: string;
  rating: number;
  reviewCount: number;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  photoUrl: string | null;
  rating: number;
  reviewCount: number;
}

/**
 * Fetch rating + userRatingCount from the Google Places API (New).
 */
export async function fetchPlaceData(placeId: string): Promise<PlaceData> {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": config.googlePlacesApiKey,
      "X-Goog-FieldMask": "rating,userRatingCount",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places API error for ${placeId}: ${res.status} ${body}`);
  }

  const data = await res.json();
  return {
    placeId,
    rating: data.rating ?? 0,
    reviewCount: data.userRatingCount ?? 0,
  };
}

/**
 * Fetch full place details including name, address, and photo.
 */
export async function fetchPlaceDetails(
  placeId: string,
): Promise<PlaceDetails> {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": config.googlePlacesApiKey,
      "X-Goog-FieldMask":
        "displayName,formattedAddress,rating,userRatingCount,photos",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places API error for ${placeId}: ${res.status} ${body}`);
  }

  const data = await res.json();

  let photoUrl: string | null = null;
  if (data.photos?.length > 0) {
    const photoName = data.photos[0].name;
    photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&key=${config.googlePlacesApiKey}`;
  }

  return {
    placeId,
    name: data.displayName?.text ?? placeId,
    address: data.formattedAddress ?? "",
    photoUrl,
    rating: data.rating ?? 0,
    reviewCount: data.userRatingCount ?? 0,
  };
}
