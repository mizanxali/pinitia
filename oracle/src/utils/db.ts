import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { desc, eq } from "drizzle-orm";
import { config } from "./config.js";
import { places, placeSnapshots } from "./schema.js";

const client = postgres(config.databaseUrl);
export const db = drizzle(client);

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
  fetchedAt?: string,
) {
  await db.insert(placeSnapshots).values({
    place_id: placeId,
    rating: String(rating),
    review_count: reviewCount,
    ...(fetchedAt ? { fetched_at: new Date(fetchedAt) } : {}),
  });
}

export async function writePlace(
  placeId: string,
  name: string,
  address: string,
  photoUrl: string | null,
  city: string,
  category: string,
) {
  await db
    .insert(places)
    .values({
      place_id: placeId,
      name,
      address,
      photo_url: photoUrl,
      city,
      category,
    })
    .onConflictDoUpdate({
      target: places.place_id,
      set: { name, address, photo_url: photoUrl, city, category },
    });
}

export async function getLatestSnapshot(
  placeId: string,
): Promise<PlaceSnapshot | null> {
  const rows = await db
    .select()
    .from(placeSnapshots)
    .where(eq(placeSnapshots.place_id, placeId))
    .orderBy(desc(placeSnapshots.fetched_at))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    place_id: row.place_id,
    rating: Number(row.rating),
    review_count: row.review_count,
    fetched_at: row.fetched_at?.toISOString(),
  };
}
