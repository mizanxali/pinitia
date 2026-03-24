import cron from "node-cron";
import { getLatestSnapshot, writeSnapshot } from "./utils/db.js";
import { fetchPlaceData } from "./utils/fetcher.js";
import {
  createFollowUpMarket,
  getActiveMarkets,
  getMarketInfo,
  getMarketResult,
  postOnChain,
} from "./utils/poster.js";

interface ResolvableMarket {
  address: string;
  marketType: number;
  placeId: string;
  target: bigint;
  initialReviewCount: bigint;
}

async function run() {
  console.log(`[${new Date().toISOString()}] Oracle run started`);

  // 1. Get all unique placeIds from active markets
  const marketAddresses = await getActiveMarkets();
  console.log(`Found ${marketAddresses.length} active markets`);

  const placeIds = new Set<string>();
  const resolvablePlaceIds = new Set<string>();
  const resolvableMarkets: ResolvableMarket[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const addr of marketAddresses) {
    const info = await getMarketInfo(addr);
    if (info.resolved) continue;
    placeIds.add(info.placeId);
    if (now >= info.resolveDate) {
      resolvablePlaceIds.add(info.placeId);
      resolvableMarkets.push({
        address: addr,
        marketType: info.marketType,
        placeId: info.placeId,
        target: info.target,
        initialReviewCount: info.initialReviewCount,
      });
    }
  }

  console.log(
    `Unique places: ${placeIds.size}, resolvable: ${resolvablePlaceIds.size} (${resolvableMarkets.length} markets)`,
  );

  // 2. Fetch data for each place and write snapshots
  // Track latest review counts for follow-up market creation
  const latestReviewCounts = new Map<string, number>();

  for (const placeId of placeIds) {
    try {
      const data = await fetchPlaceData(placeId);
      await writeSnapshot(placeId, data.rating, data.reviewCount);
      latestReviewCounts.set(placeId, data.reviewCount);
      console.log(
        `Snapshot saved: ${placeId} rating=${data.rating} reviews=${data.reviewCount}`,
      );

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
            latestReviewCounts.set(placeId, snapshot.review_count);
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

  // 4. Create follow-up markets for resolved markets
  if (resolvableMarkets.length > 0) {
    console.log(`\nCreating follow-up markets...`);
    for (const m of resolvableMarkets) {
      try {
        const longWins = await getMarketResult(m.address);
        const reviewCount = latestReviewCounts.get(m.placeId) ?? Number(m.initialReviewCount);
        await createFollowUpMarket(m.address, m, longWins, reviewCount);
      } catch (err: any) {
        console.error(`  Follow-up check failed for ${m.address}:`, err.message?.slice(0, 100));
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
