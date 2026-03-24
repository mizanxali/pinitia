/**
 * Seed a handful of markets that resolve in 5 minutes, then place bets on them.
 * Run, then start the oracle — it will resolve them on the next hourly tick
 * (or restart the oracle so it runs immediately).
 *
 * Usage:
 *   npx tsx src/scripts/seed-quick.ts
 *   npx tsx src/scripts/seed-quick.ts --minutes 10   # custom resolve window
 */
import { ethers } from "ethers";
import { config } from "../utils/config.js";
import { MarketFactoryABI, MarketABI } from "../utils/abis.js";
import { fetchPlaceDetails } from "../utils/fetcher.js";
import { writePlace, writeSnapshot } from "../utils/db.js";

// --- CLI args ---
const args = process.argv.slice(2);
let resolveMinutes = 5;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--minutes") resolveMinutes = Number(args[++i]);
}

// Pick 3 venues from the full list (diverse categories)
const QUICK_VENUES = [
  { placeId: "ChIJc0JAFaUWrjsRRXSXJPX7YFo", name: "Toit" },
  { placeId: "ChIJ80IECk8UrjsRqCffDjE09lw", name: "Dyu Art Cafe" },
  { placeId: "ChIJw68tewgVrjsRnVufs2uL3bY", name: "The Grid" },
];

const BET_AMOUNT_MIN = 0.01;
const BET_AMOUNT_MAX = 0.1;
const BETS_PER_MARKET = 2;

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randAmount(): string {
  const minMilli = Math.round(BET_AMOUNT_MIN * 1000);
  const maxMilli = Math.round(BET_AMOUNT_MAX * 1000);
  const milli = randBetween(minMilli, maxMilli);
  return (milli / 1000).toFixed(3);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(config.minitiaRpcUrl);
  const wallet = new ethers.Wallet(config.oraclePrivateKey, provider);
  const factory = new ethers.Contract(
    config.marketFactoryAddress,
    MarketFactoryABI,
    wallet,
  );

  const resolveDate = Math.floor(Date.now() / 1000) + resolveMinutes * 60;
  const resolveTime = new Date(resolveDate * 1000).toLocaleTimeString();
  const balance = await provider.getBalance(wallet.address);

  console.log("=== Quick-Market Seed ===");
  console.log(`Wallet:       ${wallet.address}`);
  console.log(`Balance:      ${ethers.formatEther(balance)} GAS`);
  console.log(`Resolve in:   ${resolveMinutes} minutes (${resolveTime})`);
  console.log(`Venues:       ${QUICK_VENUES.length}`);
  console.log();

  const createdMarkets: { address: string; venue: string; type: string }[] = [];

  // ── Phase 1: Create markets ──────────────────────────────────────────

  for (const venue of QUICK_VENUES) {
    console.log(`\n--- ${venue.name} (${venue.placeId}) ---`);

    // Fetch live data from Google Places
    const details = await fetchPlaceDetails(venue.placeId);
    console.log(
      `  Live data: rating=${details.rating}, reviews=${details.reviewCount}`,
    );

    // Write to Supabase
    await writePlace(
      venue.placeId,
      details.name,
      details.address,
      details.photoUrl,
    );
    await writeSnapshot(venue.placeId, details.rating, details.reviewCount);
    console.log("  Supabase: place + snapshot saved");

    // Create 1 VELOCITY market: target = +5 reviews (easy to reason about)
    const velocityTarget = 5;
    const txV = await factory.createVelocityMarket(
      venue.placeId,
      velocityTarget,
      resolveDate,
      details.reviewCount,
    );
    const receiptV = await txV.wait();
    // Get market address from event
    const vLog = receiptV.logs.find(
      (l: any) => l.fragment?.name === "MarketCreated",
    );
    const vAddr = vLog?.args?.[0] ?? "unknown";
    console.log(`  VELOCITY  target=+${velocityTarget} reviews  →  ${vAddr}`);
    createdMarkets.push({
      address: vAddr,
      venue: venue.name,
      type: "VELOCITY",
    });

    // Create 1 RATING market: target = current rating + 0.1
    const ratingTarget = Math.min(details.rating + 0.1, 5.0);
    const scaledTarget = Math.round(ratingTarget * 100);
    const txR = await factory.createRatingMarket(
      venue.placeId,
      scaledTarget,
      resolveDate,
    );
    const receiptR = await txR.wait();
    const rLog = receiptR.logs.find(
      (l: any) => l.fragment?.name === "MarketCreated",
    );
    const rAddr = rLog?.args?.[0] ?? "unknown";
    console.log(
      `  RATING    target>=${ratingTarget.toFixed(2)} (${scaledTarget})  →  ${rAddr}`,
    );
    createdMarkets.push({ address: rAddr, venue: venue.name, type: "RATING" });
  }

  console.log(`\n=== Created ${createdMarkets.length} markets ===\n`);

  // ── Phase 2: Place bets ──────────────────────────────────────────────

  console.log("--- Placing bets ---\n");

  let totalBets = 0;
  let totalSpent = 0n;

  for (const m of createdMarkets) {
    const market = new ethers.Contract(m.address, MarketABI, wallet);
    console.log(`${m.venue} / ${m.type} (${m.address})`);

    for (let i = 0; i < BETS_PER_MARKET; i++) {
      const amount = randAmount();
      const value = ethers.parseEther(amount);
      // Alternate LONG/SHORT so both pools have liquidity
      const isLong = i % 2 === 0;
      const side = isLong ? "LONG" : "SHORT";
      const fn = isLong ? "betLong" : "betShort";

      try {
        const tx = await market[fn]({ value });
        await tx.wait();
        totalBets++;
        totalSpent += value;
        console.log(`  ${side}  ${amount} GAS  ✓`);
      } catch (err: any) {
        console.log(
          `  ${side}  ${amount} GAS  ✗  ${err.message?.slice(0, 60)}`,
        );
      }
    }

    // Show pool state
    const info = await market.getMarketInfo();
    console.log(
      `  Pools → LONG: ${ethers.formatEther(info[4])} | SHORT: ${ethers.formatEther(info[5])} GAS`,
    );
    console.log();
  }

  // ── Summary ──────────────────────────────────────────────────────────

  console.log("=== Done ===");
  console.log(`Markets created: ${createdMarkets.length}`);
  console.log(`Bets placed:     ${totalBets}`);
  console.log(`GAS spent:       ${ethers.formatEther(totalSpent)}`);
  console.log();
  console.log(`Markets will be resolvable at ${resolveTime}`);
  console.log("Start the oracle now:  bun run start");
  console.log(
    "It runs immediately on start + every hour. Once the resolve time passes,",
  );
  console.log(
    "the next oracle run will post on-chain data and auto-resolve these markets.",
  );
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
