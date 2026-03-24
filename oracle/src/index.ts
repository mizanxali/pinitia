import cron from "node-cron";
import { getActiveMarkets, getMarketInfo, postOnChain } from "./poster.js";
import { fetchPlaceData } from "./fetcher.js";
import { writeSnapshot, getLatestSnapshot } from "./db.js";

async function run() {
  console.log(`[${new Date().toISOString()}] Oracle run started`);

  // 1. Get all unique placeIds from active markets
  const marketAddresses = await getActiveMarkets();
  console.log(`Found ${marketAddresses.length} active markets`);

  const placeIds = new Set<string>();
  const resolvablePlaceIds = new Set<string>();
  const now = Math.floor(Date.now() / 1000);

  for (const addr of marketAddresses) {
    const info = await getMarketInfo(addr);
    if (info.resolved) continue;
    placeIds.add(info.placeId);
    if (now >= info.resolveDate) {
      resolvablePlaceIds.add(info.placeId);
    }
  }

  console.log(`Unique places: ${placeIds.size}, resolvable: ${resolvablePlaceIds.size}`);

  // 2. Fetch data for each place and write snapshots
  for (const placeId of placeIds) {
    try {
      const data = await fetchPlaceData(placeId);
      await writeSnapshot(placeId, data.rating, data.reviewCount);
      console.log(`Snapshot saved: ${placeId} rating=${data.rating} reviews=${data.reviewCount}`);

      // 3. Post on-chain only for resolvable markets
      if (resolvablePlaceIds.has(placeId)) {
        await postOnChain(data);
      }
    } catch (err) {
      console.error(`Error processing ${placeId}:`, err);

      // Fallback: try latest Supabase snapshot for on-chain posting
      if (resolvablePlaceIds.has(placeId)) {
        try {
          const snapshot = await getLatestSnapshot(placeId);
          if (snapshot) {
            console.log(`Using fallback snapshot for ${placeId}`);
            await postOnChain({
              placeId,
              rating: Number(snapshot.rating),
              reviewCount: snapshot.review_count,
            });
          }
        } catch (fallbackErr) {
          console.error(`Fallback also failed for ${placeId}:`, fallbackErr);
        }
      }
    }
  }

  console.log(`[${new Date().toISOString()}] Oracle run complete`);
}

// Run immediately on start, then every hour
run().catch(console.error);
cron.schedule("0 * * * *", () => {
  run().catch(console.error);
});

console.log("Oracle cron scheduled (every hour)");
