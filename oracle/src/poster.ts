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
    target: info.target,
    resolveDate: Number(info.resolveDate),
    resolved: info.resolved,
  };
}
