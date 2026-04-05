/**
 * Force-resolve a market before its expiry date.
 *
 * Usage:
 *   npx tsx src/scripts/force-resolve.ts <MARKET_ID> [long|short]
 *
 * Examples:
 *   npx tsx src/scripts/force-resolve.ts 1 long
 *   npx tsx src/scripts/force-resolve.ts 2 short
 *   npx tsx src/scripts/force-resolve.ts 3          # defaults to long
 */
import { execSync } from "node:child_process";
import { config } from "../utils/config.js";
import { getMarketInfo, getMarketResult } from "../utils/poster.js";

const marketIdArg = process.argv[2];
const side = (process.argv[3] || "long").toLowerCase();

if (!marketIdArg) {
  console.error(
    "Usage: npx tsx src/scripts/force-resolve.ts <MARKET_ID> [long|short]",
  );
  process.exit(1);
}

if (side !== "long" && side !== "short") {
  console.error('Side must be "long" or "short"');
  process.exit(1);
}

const marketId = Number(marketIdArg);

async function main() {
  console.log("=== Force Resolve ===");
  console.log(`Market ID:   ${marketId}`);
  console.log(`Module:      ${config.moduleAddress}::${config.moduleName}`);
  console.log(`Oracle key:  ${config.oracleKeyName}`);
  console.log();

  // Read market info
  const info = await getMarketInfo(marketId);

  if (info.resolved) {
    console.error("ERROR: Market is already resolved.");
    process.exit(1);
  }

  const isVelocity = info.marketType === 0;
  if (isVelocity) {
    console.log(`Type:        VELOCITY (review count gain >= ${info.target})`);
  } else {
    console.log(
      `Type:        RATING (final rating >= ${Number(info.target) / 100})`,
    );
  }
  console.log(`Place ID:    ${info.placeId}`);
  console.log(`Winner:      ${side.toUpperCase()}`);
  console.log();

  // Compute values that make the chosen side win
  let rating: bigint;
  let reviewCount: bigint;

  if (side === "long") {
    if (isVelocity) {
      reviewCount = info.initialReviewCount + info.target + 10n;
      rating = 450n;
    } else {
      rating = info.target + 10n;
      reviewCount = info.initialReviewCount + 5n;
    }
  } else {
    if (isVelocity) {
      reviewCount = info.initialReviewCount;
      rating = 450n;
    } else {
      rating = info.target - 10n;
      reviewCount = info.initialReviewCount + 5n;
    }
  }

  console.log(`Submitting: rating=${rating}, reviewCount=${reviewCount}`);
  console.log();

  // Send force_resolve_market tx
  console.log("Sending force_resolve_market tx...");
  const argsJson = JSON.stringify([
    `address:${config.moduleAddress}`,
    `u64:${marketId}`,
    `u64:${rating.toString()}`,
    `u64:${reviewCount.toString()}`,
  ]);
  const cmd =
    `minitiad tx move execute ${config.moduleAddress} ${config.moduleName} force_resolve_market ` +
    `--args '${argsJson}' ` +
    `--from ${config.oracleKeyName} --keyring-backend test ` +
    `--chain-id ${config.chainId} ` +
    `--gas auto --gas-adjustment 1.4 --yes -o json`;
  console.log(`  > ${cmd.slice(0, 120)}...`);
  const output = execSync(cmd, { encoding: "utf-8", timeout: 30_000 }).trim();
  console.log("Tx submitted.");
  console.log();

  // Wait a moment for the tx to be included
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Verify
  const longWins = await getMarketResult(marketId);
  const infoAfter = await getMarketInfo(marketId);

  if (infoAfter.resolved) {
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
