import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
);

export interface PlaceSnapshot {
  place_id: string;
  rating: number;
  review_count: number;
  fetched_at?: string;
}

export async function writeSnapshot(
  placeId: string,
  rating: number,
  reviewCount: number,
) {
  const { error } = await supabase.from("place_snapshots").insert({
    place_id: placeId,
    rating,
    review_count: reviewCount,
  });
  if (error)
    throw new Error(`Supabase insert failed for ${placeId}: ${error.message}`);
}

export async function writePlace(
  placeId: string,
  name: string,
  address: string,
  photoUrl: string | null,
  city: string,
  category: string,
) {
  const { error } = await supabase.from("places").upsert(
    {
      place_id: placeId,
      name,
      address,
      photo_url: photoUrl,
      city,
      category,
    },
    { onConflict: "place_id" },
  );
  if (error)
    throw new Error(
      `Supabase places upsert failed for ${placeId}: ${error.message}`,
    );
}

export async function getLatestSnapshot(
  placeId: string,
): Promise<PlaceSnapshot | null> {
  const { data, error } = await supabase
    .from("place_snapshots")
    .select("*")
    .eq("place_id", placeId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Supabase read failed for ${placeId}: ${error.message}`);
  }
  return data ?? null;
}
