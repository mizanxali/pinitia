/**
 * Force-resolve a market before its expiry date.
 *
 * Usage:
 *   npx tsx src/scripts/force-resolve.ts <MARKET_ADDRESS> [long|short]
 *
 * Examples:
 *   npx tsx src/scripts/force-resolve.ts 0x1234...abcd long
 *   npx tsx src/scripts/force-resolve.ts 0x1234...abcd short
 *   npx tsx src/scripts/force-resolve.ts 0x1234...abcd          # defaults to long
 */
import { ethers } from "ethers";
import { config } from "../utils/config.js";
import { PlaceOracleABI, MarketABI } from "../utils/abis.js";

const marketAddress = process.argv[2];
const side = (process.argv[3] || "long").toLowerCase();

if (!marketAddress) {
  console.error(
    "Usage: npx tsx src/scripts/force-resolve.ts <MARKET_ADDRESS> [long|short]",
  );
  process.exit(1);
}

if (side !== "long" && side !== "short") {
  console.error('Side must be "long" or "short"');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(config.minitiaRpcUrl);
const wallet = new ethers.Wallet(config.oraclePrivateKey, provider);
const oracle = new ethers.Contract(
  config.placeOracleAddress,
  PlaceOracleABI,
  wallet,
);
const market = new ethers.Contract(marketAddress, MarketABI, provider);

async function main() {
  console.log("=== Force Resolve ===");
  console.log(`Market:      ${marketAddress}`);
  console.log(`PlaceOracle: ${config.placeOracleAddress}`);
  console.log(`Wallet:      ${wallet.address}`);
  console.log();

  // Read market info
  const info = await market.getMarketInfo();
  const [
    marketType,
    placeId,
    target,
    ,
    longPool,
    shortPool,
    initialReviewCount,
    ,
    ,
    resolved,
  ] = info;

  if (resolved) {
    console.error("ERROR: Market is already resolved.");
    process.exit(1);
  }

  const isVelocity = Number(marketType) === 0;
  if (isVelocity) {
    console.log(`Type:        VELOCITY (review count gain >= ${target})`);
  } else {
    console.log(
      `Type:        RATING (final rating >= ${Number(target) / 100})`,
    );
  }
  console.log(`Place ID:    ${placeId}`);
  console.log(`Long Pool:   ${ethers.formatEther(longPool)} GAS`);
  console.log(`Short Pool:  ${ethers.formatEther(shortPool)} GAS`);
  console.log(`Winner:      ${side.toUpperCase()}`);
  console.log();

  // Compute values that make the chosen side win
  let rating: bigint;
  let reviewCount: bigint;

  if (side === "long") {
    if (isVelocity) {
      reviewCount = BigInt(initialReviewCount) + BigInt(target) + 10n;
      rating = 450n;
    } else {
      rating = BigInt(target) + 10n;
      reviewCount = BigInt(initialReviewCount) + 5n;
    }
  } else {
    if (isVelocity) {
      reviewCount = BigInt(initialReviewCount);
      rating = 450n;
    } else {
      rating = BigInt(target) - 10n;
      reviewCount = BigInt(initialReviewCount) + 5n;
    }
  }

  console.log(`Submitting: rating=${rating}, reviewCount=${reviewCount}`);
  console.log();

  // Send forceResolveMarket tx
  console.log("Sending forceResolveMarket tx...");
  const tx = await oracle.forceResolveMarket(
    marketAddress,
    rating,
    reviewCount,
  );
  console.log(`Tx hash: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}`);
  console.log();

  // Verify
  const resolvedNow = await market.resolved();
  const longWins = await market.longWins();

  if (resolvedNow) {
    console.log("=== Market Resolved! ===");
    console.log(`Result: ${longWins ? "LONG" : "SHORT"} wins`);
    console.log();
    console.log(
      "Go to the market page on the frontend to see results and claim winnings.",
    );
  } else {
    console.error(
      "WARNING: Market still shows as unresolved. Check the tx for errors.",
    );
  }
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
