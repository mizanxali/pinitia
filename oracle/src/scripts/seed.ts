import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { MarketFactoryABI, MarketABI } from "../utils/abis.js";
import { config } from "../utils/config.js";
import { writeSnapshot, writePlace, getLatestSnapshot } from "../utils/db.js";
import { fetchPlaceDetails } from "../utils/fetcher.js";

interface VenueEntry {
  placeId: string;
}

const VELOCITY_TARGETS = [20, 50];
const RATING_OFFSETS = [0.1, 0.2];
const MAX_RATING_SCALED = 500; // 5.00 * 100
const RESOLVE_DATE = "2026-04-10"; // all markets resolve on this date

function isoToUnixUtcMidnight(iso: string): number {
  return Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 1000);
}

async function seed() {
  const venues: VenueEntry[] = JSON.parse(
    readFileSync(new URL("../data/venues.json", import.meta.url), "utf-8"),
  );
  const placeIds = venues.map((v) => v.placeId);

  const provider = new ethers.JsonRpcProvider(config.minitiaRpcUrl);
  const wallet = new ethers.Wallet(config.oraclePrivateKey, provider);
  const factory = new ethers.Contract(
    config.marketFactoryAddress,
    MarketFactoryABI,
    wallet,
  );

  const resolveTimestamp = isoToUnixUtcMidnight(RESOLVE_DATE);
  console.log(`Resolve date: ${RESOLVE_DATE} (${resolveTimestamp})`);
  console.log(`Venues: ${placeIds.length}`);
  console.log();

  for (const placeId of placeIds) {
    console.log(`\n=== ${placeId} ===`);

    // Fetch current data from Places API
    const data = await fetchPlaceDetails(placeId);
    console.log(
      `  ${data.name}: rating=${data.rating}, reviews=${data.reviewCount}`,
    );

    // Upsert place metadata + write snapshot
    await writePlace(placeId, data.name, data.address, data.photoUrl);
    await writeSnapshot(placeId, data.rating, data.reviewCount);
    console.log("  Place + snapshot saved");

    // Check existing markets for idempotency
    const existingMarkets: string[] = await factory.getMarketsByPlace(placeId);
    const existingKeys = new Set<string>();

    for (const addr of existingMarkets) {
      const market = new ethers.Contract(addr, MarketABI, provider);
      const info = await market.getMarketInfo();
      const type = Number(info[0]) === 0 ? "V" : "R";
      const target = Number(info[2]);
      const resolve = Number(info[3]);
      existingKeys.add(`${type}-${target}-${resolve}`);
    }

    // --- Velocity markets ---
    for (const target of VELOCITY_TARGETS) {
      const key = `V-${target}-${resolveTimestamp}`;
      if (existingKeys.has(key)) {
        console.log(`  SKIP VELOCITY target=${target} — already exists`);
        continue;
      }

      const tx = await factory.createVelocityMarket(
        placeId,
        target,
        resolveTimestamp,
        data.reviewCount,
      );
      const receipt = await tx.wait();
      console.log(
        `  VELOCITY target=+${target} reviews | tx: ${receipt.hash.slice(0, 20)}...`,
      );
    }

    // --- Rating markets ---
    // Use latest snapshot rating (from Supabase or freshly written)
    const snapshot = await getLatestSnapshot(placeId);
    const currentRating = snapshot?.rating ?? data.rating;

    for (const offset of RATING_OFFSETS) {
      const rawTarget = currentRating + offset;
      const cappedTarget = Math.min(rawTarget, 5.0);
      const scaledTarget = Math.round(cappedTarget * 100); // e.g. 4.3 -> 430

      if (scaledTarget > MAX_RATING_SCALED) continue; // skip if somehow > 5.00

      const key = `R-${scaledTarget}-${resolveTimestamp}`;
      if (existingKeys.has(key)) {
        console.log(
          `  SKIP RATING target=${cappedTarget.toFixed(2)} — already exists`,
        );
        continue;
      }

      const tx = await factory.createRatingMarket(
        placeId,
        scaledTarget,
        resolveTimestamp,
      );
      const receipt = await tx.wait();
      console.log(
        `  RATING   target>=${cappedTarget.toFixed(2)} (${scaledTarget}) | tx: ${receipt.hash.slice(0, 20)}...`,
      );
    }
  }

  console.log("\n=== Seed complete ===");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
