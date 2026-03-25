/**
 * Seed places to Supabase (name, address, photo, city, category).
 * Does NOT create markets or place bets — use seed-markets.ts or seed-quick.ts for that.
 *
 * Usage:
 *   bun run seed-places
 */
import { readFileSync } from "node:fs";
import { fetchPlaceDetails } from "../utils/fetcher.js";
import { writePlace, writeSnapshot } from "../utils/db.js";
import { PLACE_TYPE_TO_CATEGORY } from "../utils/place-types.js";

interface VenueEntry {
  placeId: string;
  city: string;
}

async function seedPlaces() {
  const venues: VenueEntry[] = JSON.parse(
    readFileSync(new URL("../data/venues.json", import.meta.url), "utf-8"),
  );

  console.log("=== Seed Places ===");
  console.log(`Venues: ${venues.length}`);
  console.log();

  let saved = 0;

  for (const venue of venues) {
    const placeId = venue.placeId;
    console.log(`\n--- ${placeId} ---`);

    const data = await fetchPlaceDetails(placeId);
    console.log(
      `  ${data.name}: rating=${data.rating}, reviews=${data.reviewCount}`,
    );

    await writePlace(
      placeId,
      data.name,
      data.address,
      data.photoUrl,
      venue.city,
      PLACE_TYPE_TO_CATEGORY[data.primaryType] ?? "Other",
    );
    await writeSnapshot(placeId, data.rating, data.reviewCount);
    console.log("  Supabase: place + snapshot saved");
    saved++;
  }

  console.log(`\n=== Done: ${saved} places saved to Supabase ===`);
}

seedPlaces().catch((err) => {
  console.error("Seed places failed:", err);
  process.exit(1);
});
