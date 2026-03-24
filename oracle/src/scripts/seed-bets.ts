/**
 * Seed random LONG/SHORT bets on all active markets using the oracle wallet.
 *
 * Usage:
 *   npx tsx src/scripts/seed-bets.ts                        # 1-3 bets per market, 0.01-0.5 GAS
 *   npx tsx src/scripts/seed-bets.ts --bets 5               # up to 5 bets per market
 *   npx tsx src/scripts/seed-bets.ts --max-amount 2         # up to 2 GAS per bet
 *   npx tsx src/scripts/seed-bets.ts --bets 4 --max-amount 1
 */
import { ethers } from "ethers";
import { config } from "../utils/config.js";
import { MarketFactoryABI, MarketABI } from "../utils/abis.js";

// Parse CLI args
const args = process.argv.slice(2);
let maxBetsPerMarket = 3;
let minAmountEth = 0.01;
let maxAmountEth = 0.5;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--bets") maxBetsPerMarket = Number(args[++i]);
  else if (args[i] === "--max-amount") maxAmountEth = Number(args[++i]);
  else if (args[i] === "--min-amount") minAmountEth = Number(args[++i]);
}

const provider = new ethers.JsonRpcProvider(config.minitiaRpcUrl);
const wallet = new ethers.Wallet(config.oraclePrivateKey, provider);
const factory = new ethers.Contract(
  config.marketFactoryAddress,
  MarketFactoryABI,
  provider,
);

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randAmount(): string {
  const minMilli = Math.round(minAmountEth * 1000);
  const maxMilli = Math.round(maxAmountEth * 1000);
  const milli = randBetween(minMilli, maxMilli);
  return (milli / 1000).toFixed(3);
}

async function main() {
  const balance = await provider.getBalance(wallet.address);

  console.log("=== Seed Bets ===");
  console.log(`Wallet:    ${wallet.address}`);
  console.log(`Balance:   ${ethers.formatEther(balance)} GAS`);
  console.log(`Factory:   ${config.marketFactoryAddress}`);
  console.log(`Max bets:  ${maxBetsPerMarket} per market`);
  console.log(`Bet range: ${minAmountEth} - ${maxAmountEth} GAS`);
  console.log();

  // Fetch active markets
  console.log("Fetching active markets...");
  const markets: string[] = await factory.getActiveMarkets();

  if (markets.length === 0) {
    console.log("No active markets found. Create some markets first.");
    return;
  }
  console.log(`Found ${markets.length} active market(s)`);
  console.log();

  let totalBets = 0;
  let totalSpent = 0n;

  for (const marketAddr of markets) {
    const market = new ethers.Contract(marketAddr, MarketABI, provider);

    console.log(`--- Market: ${marketAddr} ---`);

    const info = await market.getMarketInfo();
    const [marketType, placeId, target, , , , , , , resolved] = info;

    if (resolved) {
      console.log("  Already resolved, skipping");
      console.log();
      continue;
    }

    const isVelocity = Number(marketType) === 0;
    if (isVelocity) {
      console.log(
        `  Type: VELOCITY | Place: ${placeId} | Target: +${target} reviews`,
      );
    } else {
      console.log(
        `  Type: RATING   | Place: ${placeId} | Target: >= ${Number(target) / 100}`,
      );
    }

    const numBets = randBetween(1, maxBetsPerMarket);
    console.log(`  Placing ${numBets} bet(s)...`);

    for (let i = 1; i <= numBets; i++) {
      const amount = randAmount();
      const value = ethers.parseEther(amount);
      const isLong = Math.random() < 0.5;
      const side = isLong ? "LONG" : "SHORT";
      const func = isLong ? "betLong" : "betShort";

      try {
        const marketWithSigner = market.connect(wallet) as ethers.Contract;
        const tx = await marketWithSigner[func]({ value });
        await tx.wait();
        totalBets++;
        totalSpent += value;
        console.log(
          `    [${i}] ${side} ${amount} GAS | tx: ${tx.hash.slice(0, 20)}...`,
        );
      } catch (err: any) {
        console.log(
          `    [${i}] FAILED: ${side} ${amount} GAS — ${err.message?.slice(0, 60)}`,
        );
      }
    }

    // Show updated pools
    const updated = await market.getMarketInfo();
    const longPool = updated[4];
    const shortPool = updated[5];
    console.log(
      `  Pools -> LONG: ${ethers.formatEther(longPool)} GAS | SHORT: ${ethers.formatEther(shortPool)} GAS`,
    );
    console.log();
  }

  console.log("=== Done! ===");
  console.log(`Total bets: ${totalBets}`);
  console.log(`Total spent: ${ethers.formatEther(totalSpent)} GAS`);
  console.log();
  console.log("Refresh the frontend to see the bets.");
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
