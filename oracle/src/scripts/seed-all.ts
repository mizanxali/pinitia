/**
 * Master seed script for Move-based prediction markets.
 *
 * Steps:
 *   1. Seed places — upsert venues to PostgreSQL
 *   2. Seed markets — 2 per ~50% of venues (VELOCITY + RATING)
 *   3. Seed bets — random LONG/SHORT bets on ~50% of active markets
 *   4. Force resolve — one random market per place
 *
 * Usage:
 *   npx tsx src/scripts/seed-all.ts
 *   npx tsx src/scripts/seed-all.ts --bets 5 --max-amount 2
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { config } from "../utils/config.js";
import { fetchPlaceData, fetchPlaceDetails } from "../utils/fetcher.js";
import { writePlace, writeSnapshot } from "../utils/db.js";
import { PLACE_TYPE_TO_CATEGORY } from "../utils/place-types.js";
import {
  getActiveMarkets,
  getMarketInfo,
  getMarketResult,
} from "../utils/poster.js";

interface VenueEntry {
  placeId: string;
  city: string;
  name: string;
}

// --- CLI args ---
const args = process.argv.slice(2);
let maxBetsPerMarket = 3;
let minAmountMin = 1;
let maxAmountMin = 3;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--bets") maxBetsPerMarket = Number(args[++i]);
  else if (args[i] === "--max-amount") maxAmountMin = Number(args[++i]);
  else if (args[i] === "--min-amount") minAmountMin = Number(args[++i]);
}

// --- Constants ---
const VELOCITY_TARGET_OFFSET = 10;
const RATING_OFFSET = 0.1;
const MAX_RATING_SCALED = 500;
const RESOLVE_HOURS = 1;

// --- Helpers ---
function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randAmount(): number {
  const minMicro = Math.round(minAmountMin * 1e6);
  const maxMicro = Math.round(maxAmountMin * 1e6);
  return randBetween(minMicro, maxMicro);
}

function pickRandom<T>(arr: T[], ratio = 0.5): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.max(1, Math.ceil(arr.length * ratio)));
}

function moveExecute(
  functionName: string,
  moveArgs: string[],
  fromKey?: string,
): string {
  const argsJson = JSON.stringify(moveArgs);
  const from = fromKey ?? config.oracleKeyName;
  const cmd =
    `minitiad tx move execute ${config.moduleAddress} ${config.moduleName} ${functionName} ` +
    `--args '${argsJson}' ` +
    `--from ${from} --keyring-backend test ` +
    `--chain-id ${config.chainId} ` +
    `--gas auto --gas-adjustment 1.4 --yes -o json`;
  console.log(`  > ${cmd.slice(0, 120)}...`);
  return execSync(cmd, { encoding: "utf-8", timeout: 30_000 }).trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// STEP 1: Seed Places
// ============================================================
async function seedPlaces(): Promise<VenueEntry[]> {
  const venues: VenueEntry[] = JSON.parse(
    readFileSync(new URL("../data/venues.json", import.meta.url), "utf-8"),
  );

  console.log("╔══════════════════════════════════════╗");
  console.log("║        STEP 1: SEED PLACES           ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Venues: ${venues.length}`);

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

      // Generate historical snapshots
      const now = Date.now();
      let histRating = data.rating;
      let histReviews = data.reviewCount;
      for (let i = 1; i <= 5; i++) {
        const fetchedAt = new Date(now - i * 60 * 60 * 1000).toISOString();
        if (Math.random() < 0.5 && histRating >= 0.1)
          histRating = Math.round((histRating - 0.1) * 10) / 10;
        const dec = [1, 2, 5, 10][Math.floor(Math.random() * 4)];
        histReviews = Math.max(0, histReviews - dec);
        await writeSnapshot(venue.placeId, histRating, histReviews, fetchedAt);
      }
      console.log(
        `  ${data.name}: rating=${data.rating}, reviews=${data.reviewCount} ✓`,
      );
    }),
  );

  const saved = results.filter((r) => r.status === "fulfilled").length;
  console.log(`\nPlaces saved: ${saved}/${venues.length}`);
  return venues;
}

// ============================================================
// STEP 2: Seed Markets
// ============================================================
async function seedMarkets(venues: VenueEntry[]): Promise<void> {
  const selected = pickRandom(venues);
  const resolveDate = Math.floor(Date.now() / 1000) + RESOLVE_HOURS * 60 * 60;

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║        STEP 2: SEED MARKETS          ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Venues: ${selected.length}/${venues.length}`);
  console.log(`Resolves: ${new Date(resolveDate * 1000).toISOString()}`);

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

  let created = 0;
  for (const venue of selected) {
    const data = placeDataMap.get(venue.placeId)!;
    console.log(`\n--- ${venue.name} ---`);

    // VELOCITY market
    try {
      moveExecute("create_velocity_market", [
        `string:${venue.placeId}`,
        `u64:${VELOCITY_TARGET_OFFSET}`,
        `u64:${resolveDate}`,
        `u64:${data.reviewCount}`,
      ]);
      console.log(`  VELOCITY target=+${VELOCITY_TARGET_OFFSET} ✓`);
      created++;
      await sleep(2000);
    } catch (err: any) {
      console.log(`  VELOCITY FAILED: ${err.message?.slice(0, 80)}`);
    }

    // RATING market
    const ratingTarget = Math.min(data.rating + RATING_OFFSET, 5.0);
    const scaledTarget = Math.round(ratingTarget * 100);
    if (scaledTarget <= MAX_RATING_SCALED) {
      try {
        moveExecute("create_rating_market", [
          `string:${venue.placeId}`,
          `u64:${scaledTarget}`,
          `u64:${resolveDate}`,
        ]);
        console.log(`  RATING target>=${ratingTarget.toFixed(2)} ✓`);
        created++;
        await sleep(2000);
      } catch (err: any) {
        console.log(`  RATING FAILED: ${err.message?.slice(0, 80)}`);
      }
    }
  }

  console.log(`\nMarkets created: ${created}`);
}

// ============================================================
// STEP 3: Seed Bets
// ============================================================
async function seedBets(): Promise<void> {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║         STEP 3: SEED BETS            ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Max bets: ${maxBetsPerMarket} per market`);
  console.log(`Bet range: ${minAmountMin}-${maxAmountMin} MIN`);

  const allMarketIds = await getActiveMarkets();
  if (allMarketIds.length === 0) {
    console.log("No active markets found.");
    return;
  }

  const selectedIds = pickRandom(allMarketIds);
  console.log(`Selected ${selectedIds.length}/${allMarketIds.length} markets`);

  let totalBets = 0;
  for (const marketId of selectedIds) {
    const info = await getMarketInfo(marketId);
    if (info.resolved) continue;

    const numBets = randBetween(1, maxBetsPerMarket);
    console.log(`\n--- Market #${marketId} (${info.placeId}) ---`);

    for (let b = 0; b < numBets; b++) {
      const amount = randAmount();
      const isLong = Math.random() < 0.5;
      const func = isLong ? "bet_long" : "bet_short";

      try {
        moveExecute(func, [
          `address:${config.moduleAddress}`,
          `u64:${marketId}`,
          `u64:${amount}`,
        ]);
        const side = isLong ? "LONG" : "SHORT";
        console.log(`  ${side} ${(amount / 1e6).toFixed(2)} MIN ✓`);
        totalBets++;
        await sleep(2000);
      } catch (err: any) {
        console.log(`  BET FAILED: ${err.message?.slice(0, 60)}`);
      }
    }
  }

  console.log(`\nTotal bets: ${totalBets}`);
}

// ============================================================
// STEP 4: Force Resolve
// ============================================================
async function forceResolveOnePerPlace(): Promise<void> {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║    STEP 4: FORCE RESOLVE (1/place)   ║");
  console.log("╚══════════════════════════════════════╝\n");

  const allMarketIds = await getActiveMarkets();
  const placeToMarkets = new Map<string, number[]>();

  for (const marketId of allMarketIds) {
    const info = await getMarketInfo(marketId);
    if (info.resolved) continue;
    const list = placeToMarkets.get(info.placeId) ?? [];
    list.push(marketId);
    placeToMarkets.set(info.placeId, list);
  }

  let resolved = 0;
  for (const [placeId, marketIds] of placeToMarkets) {
    const idx = Math.floor(Math.random() * marketIds.length);
    const marketId = marketIds[idx];
    const info = await getMarketInfo(marketId);
    const isVelocity = info.marketType === 0;
    const side = Math.random() < 0.5 ? "long" : "short";

    console.log(`--- ${placeId} | Market #${marketId} ---`);
    console.log(
      `  Type: ${isVelocity ? "VELOCITY" : "RATING"} | Winner: ${side.toUpperCase()}`,
    );

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

    try {
      moveExecute("force_resolve_market", [
        `address:${config.moduleAddress}`,
        `u64:${marketId}`,
        `u64:${rating.toString()}`,
        `u64:${reviewCount.toString()}`,
      ]);
      console.log(`  Resolved ✓`);

      const longWins = await getMarketResult(marketId);
      console.log(`  Result: ${longWins ? "LONG" : "SHORT"} wins`);
      resolved++;
      await sleep(2000);
    } catch (err: any) {
      console.log(`  FAILED: ${err.message?.slice(0, 80)}`);
    }
  }

  console.log(`\nForce-resolved: ${resolved} market(s)`);
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log("========================================");
  console.log("      PINITIA MASTER SEED (Move)");
  console.log("========================================\n");

  const venues = await seedPlaces();
  await seedMarkets(venues);
  await seedBets();
  await forceResolveOnePerPlace();

  console.log("\n========================================");
  console.log("            ALL DONE!");
  console.log("========================================");
}

main().catch((err) => {
  console.error("Master seed failed:", err);
  process.exit(1);
});
