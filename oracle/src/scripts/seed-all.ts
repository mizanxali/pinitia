/**
 * Master seed script: creates markets, places bets, then force-resolves
 * one random market per venue.
 *
 * Steps:
 *   1. Seed places — upsert venues to Supabase (name, address, photo, city, category)
 *   2. Seed markets — 2 per ~50% of venues (VELOCITY + RATING)
 *   3. Seed bets — random LONG/SHORT bets on ~50% of active markets
 *   4. Force resolve — one random market per place
 *
 * Usage:
 *   npx tsx src/scripts/seed-all.ts
 *   npx tsx src/scripts/seed-all.ts --bets 5 --max-amount 2
 */
/** biome-ignore-all lint/style/noNonNullAssertion: it's fine - it's just a seed script */
/** biome-ignore-all lint/suspicious/noExplicitAny: it's fine - it's just a seed script */
import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { MarketFactoryABI, MarketABI, PlaceOracleABI } from "../utils/abis.js";
import { config } from "../utils/config.js";
import { fetchPlaceData, fetchPlaceDetails } from "../utils/fetcher.js";
import { writePlace, writeSnapshot } from "../utils/db.js";
import { PLACE_TYPE_TO_CATEGORY } from "../utils/place-types.js";

interface VenueEntry {
  placeId: string;
  city: string;
  name: string;
}

// --- CLI args ---
const args = process.argv.slice(2);
let maxBetsPerMarket = 3;
let minAmountEth = 1;
let maxAmountEth = 3;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--bets") maxBetsPerMarket = Number(args[++i]);
  else if (args[i] === "--max-amount") maxAmountEth = Number(args[++i]);
  else if (args[i] === "--min-amount") minAmountEth = Number(args[++i]);
}

// --- Constants ---
const VELOCITY_TARGET_OFFSET = 10;
const RATING_OFFSET = 0.1;
const MAX_RATING_SCALED = 500;
const RESOLVE_HOURS = 1;

// --- Shared setup ---
const provider = new ethers.JsonRpcProvider(config.minitiaRpcUrl);
const wallet = new ethers.Wallet(config.oraclePrivateKey, provider);
const factory = new ethers.Contract(
  config.marketFactoryAddress,
  MarketFactoryABI,
  wallet,
);
const oracle = new ethers.Contract(
  config.placeOracleAddress,
  PlaceOracleABI,
  wallet,
);

// --- Helpers ---
function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randAmount(): string {
  const minMilli = Math.round(minAmountEth * 1000);
  const maxMilli = Math.round(maxAmountEth * 1000);
  const milli = randBetween(minMilli, maxMilli);
  return (milli / 1000).toFixed(3);
}

/** Shuffle array in place (Fisher-Yates) and return first n elements */
function pickRandom<T>(arr: T[], ratio = 0.5): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.max(1, Math.ceil(arr.length * ratio)));
}

// ============================================================
// STEP 1: Seed Places (Supabase) — parallel API + DB writes
// ============================================================
async function seedPlaces(): Promise<VenueEntry[]> {
  const venues: VenueEntry[] = JSON.parse(
    readFileSync(new URL("../data/venues.json", import.meta.url), "utf-8"),
  );

  console.log("╔══════════════════════════════════════╗");
  console.log("║        STEP 1: SEED PLACES           ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Venues: ${venues.length}`);
  console.log();

  const results = await Promise.allSettled(
    venues.map(async (venue) => {
      const data = await fetchPlaceDetails(venue.placeId);
      await Promise.all([
        writePlace(
          venue.placeId,
          data.name,
          data.address,
          data.photoUrl,
          venue.city,
          PLACE_TYPE_TO_CATEGORY[data.primaryType] ?? "Other",
        ),
        writeSnapshot(venue.placeId, data.rating, data.reviewCount),
      ]);
      console.log(
        `  ${data.name}: rating=${data.rating}, reviews=${data.reviewCount} ✓`,
      );
    }),
  );

  const saved = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected");
  for (const f of failed) {
    console.log(
      `  FAILED: ${(f as PromiseRejectedResult).reason?.message?.slice(0, 80)}`,
    );
  }
  console.log(`\nPlaces saved: ${saved}/${venues.length}`);
  return venues;
}

// ============================================================
// STEP 2: Seed Markets (~50% of venues, sequential txs)
// ============================================================
async function seedMarkets(
  venues: VenueEntry[],
): Promise<Map<string, string[]>> {
  const selected = pickRandom(venues);
  const resolveDate = Math.floor(Date.now() / 1000) + RESOLVE_HOURS * 60 * 60;
  const resolveTime = new Date(resolveDate * 1000).toISOString();
  const balance = await provider.getBalance(wallet.address);

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║        STEP 2: SEED MARKETS          ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Wallet:     ${wallet.address}`);
  console.log(`Balance:    ${ethers.formatEther(balance)} GAS`);
  console.log(`Venues:     ${selected.length}/${venues.length} (random 50%)`);
  console.log(`Resolves:   ${resolveTime} (in ${RESOLVE_HOURS}h)`);
  console.log();

  // Pre-fetch all Google Places data in parallel
  const placeDataMap = new Map<
    string,
    { rating: number; reviewCount: number }
  >();
  await Promise.all(
    selected.map(async (venue) => {
      const data = await fetchPlaceData(venue.placeId);
      placeDataMap.set(venue.placeId, data);
    }),
  );

  const marketsByPlace = new Map<string, string[]>();
  let created = 0;

  // Market creation txs must be sequential (same wallet nonce)
  for (const venue of selected) {
    const placeId = venue.placeId;
    const data = placeDataMap.get(placeId)!;
    console.log(`\n--- ${venue.name} (${placeId}) ---`);
    console.log(`  rating=${data.rating}, reviews=${data.reviewCount}`);

    const placeMarkets: string[] = [];

    // VELOCITY market
    try {
      const tx = await factory.createVelocityMarket(
        placeId,
        VELOCITY_TARGET_OFFSET,
        resolveDate,
        data.reviewCount,
      );
      const receipt = await tx.wait();
      const log = receipt.logs.find(
        (l: any) => l.fragment?.name === "MarketCreated",
      );
      const addr = log?.args?.[0] ?? "unknown";
      console.log(
        `  VELOCITY  target=+${VELOCITY_TARGET_OFFSET} reviews  ->  ${addr}`,
      );
      placeMarkets.push(addr);
      created++;
    } catch (err: any) {
      console.log(`  VELOCITY  FAILED: ${err.message?.slice(0, 80)}`);
    }

    // RATING market
    const ratingTarget = Math.min(data.rating + RATING_OFFSET, 5.0);
    const scaledTarget = Math.round(ratingTarget * 100);

    if (scaledTarget <= MAX_RATING_SCALED) {
      try {
        const tx = await factory.createRatingMarket(
          placeId,
          scaledTarget,
          resolveDate,
        );
        const receipt = await tx.wait();
        const log = receipt.logs.find(
          (l: any) => l.fragment?.name === "MarketCreated",
        );
        const addr = log?.args?.[0] ?? "unknown";
        console.log(
          `  RATING    target>=${ratingTarget.toFixed(2)} (${scaledTarget})  ->  ${addr}`,
        );
        placeMarkets.push(addr);
        created++;
      } catch (err: any) {
        console.log(`  RATING    FAILED: ${err.message?.slice(0, 80)}`);
      }
    }

    if (placeMarkets.length > 0) {
      marketsByPlace.set(placeId, placeMarkets);
    }
  }

  console.log(`\nMarkets created: ${created}`);
  return marketsByPlace;
}

// ============================================================
// STEP 3: Seed Bets (~50% of active markets)
// Pre-fund all wallets sequentially, then place bets in parallel
// ============================================================
async function seedBets(): Promise<void> {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║         STEP 3: SEED BETS            ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Max bets:  ${maxBetsPerMarket} per market`);
  console.log(`Bet range: ${minAmountEth} - ${maxAmountEth} GAS`);
  console.log();

  const allMarkets: string[] = await factory.getActiveMarkets();

  if (allMarkets.length === 0) {
    console.log("No active markets found.");
    return;
  }

  const markets = pickRandom(allMarkets);
  console.log(
    `Selected ${markets.length}/${allMarkets.length} active market(s) (random 50%)\n`,
  );

  // Fetch market info in parallel
  const marketInfos = await Promise.all(
    markets.map(async (addr) => {
      const market = new ethers.Contract(addr, MarketABI, provider);
      const info = await market.getMarketInfo();
      return { addr, info };
    }),
  );

  // Build bet plan: for each market, decide how many bets, amounts, sides
  interface BetPlan {
    marketAddr: string;
    bets: { amount: string; value: bigint; isLong: boolean }[];
  }

  const plans: BetPlan[] = [];
  for (const { addr, info } of marketInfos) {
    const [marketType, placeId, , , , , , , , resolved] = info;
    if (resolved) {
      console.log(`--- ${addr}: already resolved, skipping ---`);
      continue;
    }

    const isVelocity = Number(marketType) === 0;
    console.log(
      `--- ${addr} | ${isVelocity ? "VELOCITY" : "RATING"} | ${placeId} ---`,
    );

    const numBets = randBetween(1, maxBetsPerMarket);
    const bets = Array.from({ length: numBets }, () => {
      const amount = randAmount();
      return {
        amount,
        value: ethers.parseEther(amount),
        isLong: Math.random() < 0.5,
      };
    });
    plans.push({ marketAddr: addr, bets });
  }

  // Pre-fund all bet wallets sequentially (oracle wallet nonce must be serial)
  interface FundedBet {
    marketAddr: string;
    betWallet: ethers.Wallet | ethers.HDNodeWallet;
    amount: string;
    value: bigint;
    isLong: boolean;
    transferAmount: bigint;
  }

  const gasPadding = ethers.parseEther("0.01");
  const fundedBets: FundedBet[] = [];

  console.log(
    `\nFunding ${plans.reduce((s, p) => s + p.bets.length, 0)} wallets...`,
  );
  for (const plan of plans) {
    for (const bet of plan.bets) {
      const betWallet = ethers.Wallet.createRandom().connect(provider);
      const transferAmount = bet.value + gasPadding;
      try {
        const fundTx = await wallet.sendTransaction({
          to: betWallet.address,
          value: transferAmount,
        });
        await fundTx.wait();
        fundedBets.push({
          marketAddr: plan.marketAddr,
          betWallet,
          amount: bet.amount,
          value: bet.value,
          isLong: bet.isLong,
          transferAmount,
        });
      } catch (err: any) {
        console.log(`  Fund FAILED: ${err.message?.slice(0, 60)}`);
      }
    }
  }

  // Place all bets in parallel (each from a unique wallet — no nonce conflicts)
  console.log(`Placing ${fundedBets.length} bets in parallel...`);
  let totalBets = 0;
  let totalSpent = 0n;

  const betResults = await Promise.allSettled(
    fundedBets.map(async (fb) => {
      const market = new ethers.Contract(
        fb.marketAddr,
        MarketABI,
        fb.betWallet,
      );
      const func = fb.isLong ? "betLong" : "betShort";
      const tx = await market[func]({ value: fb.value });
      await tx.wait();
      return fb;
    }),
  );

  for (const result of betResults) {
    if (result.status === "fulfilled") {
      const fb = result.value;
      const side = fb.isLong ? "LONG" : "SHORT";
      totalBets++;
      totalSpent += fb.transferAmount;
      console.log(
        `  ${side} ${fb.amount} GAS on ${fb.marketAddr.slice(0, 10)}... | wallet: ${fb.betWallet.address.slice(0, 10)}...`,
      );
    } else {
      console.log(`  BET FAILED: ${result.reason?.message?.slice(0, 60)}`);
    }
  }

  console.log(`\nTotal bets: ${totalBets}`);
  console.log(`Total spent: ${ethers.formatEther(totalSpent)} GAS`);
}

// ============================================================
// STEP 4: Force Resolve (one random market per place)
// ============================================================
async function forceResolveOnePerPlace(
  marketsByPlace: Map<string, string[]>,
): Promise<void> {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║    STEP 4: FORCE RESOLVE (1/place)   ║");
  console.log("╚══════════════════════════════════════╝\n");

  // Pre-fetch all market info in parallel
  const resolveTargets: {
    placeId: string;
    marketAddr: string;
    info: any;
  }[] = [];

  const infoResults = await Promise.all(
    [...marketsByPlace.entries()].map(async ([placeId, marketAddrs]) => {
      const idx = Math.floor(Math.random() * marketAddrs.length);
      const marketAddr = marketAddrs[idx];
      const market = new ethers.Contract(marketAddr, MarketABI, provider);
      const info = await market.getMarketInfo();
      return { placeId, marketAddr, info };
    }),
  );
  resolveTargets.push(...infoResults);

  let resolved = 0;

  // Force-resolve txs must be sequential (same oracle wallet)
  for (const { placeId, marketAddr, info } of resolveTargets) {
    const [
      marketType,
      ,
      target,
      ,
      longPool,
      shortPool,
      initialReviewCount,
      ,
      ,
      alreadyResolved,
    ] = info;

    if (alreadyResolved) {
      console.log(`${placeId}: ${marketAddr} already resolved, skipping`);
      continue;
    }

    const isVelocity = Number(marketType) === 0;
    const side = Math.random() < 0.5 ? "long" : "short";

    console.log(`--- ${placeId} ---`);
    console.log(`  Market:  ${marketAddr}`);
    console.log(`  Type:    ${isVelocity ? "VELOCITY" : "RATING"}`);
    console.log(
      `  Pools:   LONG ${ethers.formatEther(longPool)} | SHORT ${ethers.formatEther(shortPool)} GAS`,
    );
    console.log(`  Winner:  ${side.toUpperCase()}`);

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

    try {
      const tx = await oracle.forceResolveMarket(
        marketAddr,
        rating,
        reviewCount,
      );
      const receipt = await tx.wait();
      console.log(`  Tx:      ${tx.hash}`);
      console.log(`  Block:   ${receipt.blockNumber}`);

      const market = new ethers.Contract(marketAddr, MarketABI, provider);
      const resolvedNow = await market.resolved();
      const longWins = await market.longWins();
      if (resolvedNow) {
        console.log(`  Result:  ${longWins ? "LONG" : "SHORT"} wins`);
        resolved++;
      } else {
        console.log(`  WARNING: Market still unresolved after tx`);
      }
    } catch (err: any) {
      console.log(`  FAILED:  ${err.message?.slice(0, 80)}`);
    }
    console.log();
  }

  console.log(`Force-resolved: ${resolved} market(s)`);
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log("========================================");
  console.log("         PINITIA MASTER SEED");
  console.log("========================================\n");

  // Step 1: Seed places to Supabase
  const venues = await seedPlaces();

  // Step 2: Create markets for ~50% of venues
  const marketsByPlace = await seedMarkets(venues);

  // Step 3: Seed bets on ~50% of active markets
  await seedBets();

  // Step 4: Force resolve one market per place
  await forceResolveOnePerPlace(marketsByPlace);

  console.log("\n========================================");
  console.log("            ALL DONE!");
  console.log("========================================");
  console.log(
    "Refresh the frontend to see markets, bets, and resolved results.",
  );
}

main().catch((err) => {
  console.error("Master seed failed:", err);
  process.exit(1);
});
