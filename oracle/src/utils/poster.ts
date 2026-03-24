import { ethers } from "ethers";
import { MarketABI, MarketFactoryABI, PlaceOracleABI } from "./abis.js";
import { config } from "./config.js";
import type { PlaceData } from "./fetcher.js";

const provider = new ethers.JsonRpcProvider(config.minitiaRpcUrl);
const wallet = new ethers.Wallet(config.oraclePrivateKey, provider);

export const placeOracle = new ethers.Contract(
  config.placeOracleAddress,
  PlaceOracleABI,
  wallet,
);
export const marketFactory = new ethers.Contract(
  config.marketFactoryAddress,
  MarketFactoryABI,
  wallet,
);

/**
 * Post place data on-chain. The PlaceOracle contract auto-resolves any
 * eligible markets (those past their resolveDate) for the given placeId.
 */
export async function postOnChain(data: PlaceData) {
  // rating scaled by 1e2 (e.g. 4.3 → 430)
  const ratingScaled = Math.round(data.rating * 100);
  const tx = await placeOracle.postPlaceData(
    data.placeId,
    ratingScaled,
    data.reviewCount,
  );
  await tx.wait();
  console.log(
    `Posted on-chain: ${data.placeId} rating=${data.rating} reviews=${data.reviewCount} tx=${tx.hash}`,
  );
}

/**
 * Batch-post multiple places in a single tx.
 */
export async function batchPostOnChain(items: PlaceData[]) {
  const placeIds = items.map((d) => d.placeId);
  const ratings = items.map((d) => Math.round(d.rating * 100));
  const reviewCounts = items.map((d) => d.reviewCount);
  const tx = await placeOracle.batchPost(placeIds, ratings, reviewCounts);
  await tx.wait();
  console.log(`Batch posted ${items.length} places on-chain, tx=${tx.hash}`);
}

/**
 * Get all active markets from the factory.
 */
export async function getActiveMarkets(): Promise<string[]> {
  return await marketFactory.getActiveMarkets();
}

/**
 * Read market info to extract placeId and resolveDate.
 */
export async function getMarketInfo(marketAddress: string) {
  const market = new ethers.Contract(marketAddress, MarketABI, provider);
  const info = await market.getMarketInfo();
  return {
    marketType: Number(info.marketType),
    placeId: info.placeId,
    target: BigInt(info.target),
    resolveDate: Number(info.resolveDate),
    initialReviewCount: BigInt(info.initialReviewCount),
    resolved: info.resolved,
  };
}

/**
 * Check whether a resolved market was won by LONG.
 */
export async function getMarketResult(marketAddress: string): Promise<boolean> {
  const market = new ethers.Contract(marketAddress, MarketABI, provider);
  return await market.longWins();
}

const FOLLOW_UP_RESOLVE_OFFSET = 60 * 60; // 1 hour
const VELOCITY_TARGET_BUMP = 10n;
const RATING_TARGET_BUMP = 10n; // scaled 1e2, so 10 = 0.1
const MAX_RATING_SCALED = 500n;

/**
 * Create a follow-up market after resolution.
 * - LONG wins (target achieved): bump target (+10 velocity, +0.1 rating)
 * - SHORT wins (target not achieved): keep same target
 * New market resolves in 1 hour.
 */
export async function createFollowUpMarket(
  marketAddress: string,
  info: { marketType: number; placeId: string; target: bigint; initialReviewCount: bigint },
  longWins: boolean,
  currentReviewCount: number,
) {
  const resolveDate = Math.floor(Date.now() / 1000) + FOLLOW_UP_RESOLVE_OFFSET;
  const isVelocity = info.marketType === 0;

  let newTarget = info.target;
  if (longWins) {
    newTarget = isVelocity
      ? info.target + VELOCITY_TARGET_BUMP
      : info.target + RATING_TARGET_BUMP;
  }

  // Cap rating target at 5.00 (500 scaled)
  if (!isVelocity && newTarget > MAX_RATING_SCALED) {
    newTarget = MAX_RATING_SCALED;
  }

  try {
    let tx: ethers.TransactionResponse;
    if (isVelocity) {
      tx = await marketFactory.createVelocityMarket(
        info.placeId,
        newTarget,
        resolveDate,
        currentReviewCount,
      );
    } else {
      tx = await marketFactory.createRatingMarket(
        info.placeId,
        newTarget,
        resolveDate,
      );
    }
    const receipt = await tx.wait();
    const log = receipt?.logs.find(
      (l: any) => l.fragment?.name === "MarketCreated",
    );
    const newAddr = (log as any)?.args?.[0] ?? "unknown";
    const typeLabel = isVelocity ? "VELOCITY" : "RATING";
    const action = longWins ? "bumped" : "same";
    console.log(
      `  Follow-up: ${typeLabel} target=${newTarget.toString()} (${action}) resolves=${new Date(resolveDate * 1000).toISOString()} → ${newAddr}`,
    );
  } catch (err: any) {
    // Max markets per place reached — skip silently
    if (err.message?.includes("Max markets")) {
      console.log(`  Follow-up skipped for ${info.placeId}: max markets per place reached`);
    } else {
      console.error(`  Follow-up failed for ${info.placeId}:`, err.message?.slice(0, 100));
    }
  }
}
