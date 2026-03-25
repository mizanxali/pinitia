/**
 * Seed one VELOCITY and one RATING market per venue. The oracle cron
 * auto-creates follow-up markets on resolution, so this only needs to
 * run once to bootstrap the perpetual cycle.
 *
 * Usage:
 *   bun run seed
 */
import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { MarketFactoryABI } from "../utils/abis.js";
import { config } from "../utils/config.js";
import { writeSnapshot, writePlace } from "../utils/db.js";
import { fetchPlaceDetails } from "../utils/fetcher.js";

interface VenueEntry {
  placeId: string;
}

const VELOCITY_TARGET_OFFSET = 10; // +10 reviews from current count
const RATING_OFFSET = 0.1; // +0.1 from current rating
const MAX_RATING_SCALED = 500; // 5.00 * 100
const RESOLVE_HOURS = 1; // first batch resolves in 1 hour

async function seed() {
  const venues: VenueEntry[] = JSON.parse(
    readFileSync(new URL("../data/venues.json", import.meta.url), "utf-8"),
  );

  const provider = new ethers.JsonRpcProvider(config.minitiaRpcUrl);
  const wallet = new ethers.Wallet(config.oraclePrivateKey, provider);
  const factory = new ethers.Contract(
    config.marketFactoryAddress,
    MarketFactoryABI,
    wallet,
  );

  const resolveDate = Math.floor(Date.now() / 1000) + RESOLVE_HOURS * 60 * 60;
  const resolveTime = new Date(resolveDate * 1000).toISOString();
  const balance = await provider.getBalance(wallet.address);

  console.log("=== Seed Markets ===");
  console.log(`Wallet:     ${wallet.address}`);
  console.log(`Balance:    ${ethers.formatEther(balance)} GAS`);
  console.log(`Venues:     ${venues.length}`);
  console.log(`Resolves:   ${resolveTime} (in ${RESOLVE_HOURS}h)`);
  console.log();

  let created = 0;

  for (const venue of venues) {
    const placeId = venue.placeId;
    console.log(`\n--- ${placeId} ---`);

    // Fetch live data from Google Places
    const data = await fetchPlaceDetails(placeId);
    console.log(
      `  ${data.name}: rating=${data.rating}, reviews=${data.reviewCount}`,
    );

    // Write to Supabase
    await writePlace(placeId, data.name, data.address, data.photoUrl);
    await writeSnapshot(placeId, data.rating, data.reviewCount);
    console.log("  Supabase: place + snapshot saved");

    // VELOCITY market: target = current reviews + 10
    const velocityTarget = VELOCITY_TARGET_OFFSET;
    try {
      const tx = await factory.createVelocityMarket(
        placeId,
        velocityTarget,
        resolveDate,
        data.reviewCount,
      );
      const receipt = await tx.wait();
      const log = receipt.logs.find(
        (l: any) => l.fragment?.name === "MarketCreated",
      );
      const addr = log?.args?.[0] ?? "unknown";
      console.log(`  VELOCITY  target=+${velocityTarget} reviews  →  ${addr}`);
      created++;
    } catch (err: any) {
      console.log(`  VELOCITY  FAILED: ${err.message?.slice(0, 80)}`);
    }

    // RATING market: target = current rating + 0.1 (capped at 5.0)
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
          `  RATING    target>=${ratingTarget.toFixed(2)} (${scaledTarget})  →  ${addr}`,
        );
        created++;
      } catch (err: any) {
        console.log(`  RATING    FAILED: ${err.message?.slice(0, 80)}`);
      }
    }
  }

  console.log(`\n=== Seed complete: ${created} markets created ===`);
  console.log(
    `Start the oracle (bun run start) — it will resolve these in ${RESOLVE_HOURS}h and auto-create follow-ups.`,
  );
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
