import { config } from "./config.js";

export interface PlaceData {
  placeId: string;
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
