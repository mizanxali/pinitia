import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { MarketFactoryABI } from "./abis.js";
import { config } from "./config.js";
import { writeSnapshot, writePlace } from "./db.js";
import { fetchPlaceDetails } from "./fetcher.js";

interface VenueMarket {
  type: "VELOCITY" | "RATING";
  target: number;
  resolveDate: string; // ISO date e.g. "2026-04-10"
}

interface Venue {
  placeId: string;
  markets: VenueMarket[];
}

function isoToUnixUtcMidnight(iso: string): number {
  const date = new Date(`${iso}T00:00:00Z`);
  return Math.floor(date.getTime() / 1000);
}

async function seed() {
  const venues: Venue[] = JSON.parse(
    readFileSync(new URL("./venues.json", import.meta.url), "utf-8"),
  );

  const provider = new ethers.JsonRpcProvider(config.minitiaRpcUrl);
  const wallet = new ethers.Wallet(config.oraclePrivateKey, provider);
  const factory = new ethers.Contract(
    config.marketFactoryAddress,
    MarketFactoryABI,
    wallet,
  );

  for (const venue of venues) {
    console.log(`\nProcessing venue: ${venue.placeId}`);

    // Fetch current data from Places API (includes name, address, photo)
    const data = await fetchPlaceDetails(venue.placeId);
    console.log(
      `  ${data.name}: rating=${data.rating}, reviews=${data.reviewCount}`,
    );

    // Write place metadata to Supabase
    await writePlace(venue.placeId, data.name, data.address, data.photoUrl);
    console.log(`  Place upserted`);

    // Write initial snapshot to Supabase
    await writeSnapshot(venue.placeId, data.rating, data.reviewCount);
    console.log(`  Snapshot written`);

    // Check existing markets for idempotency
    const existingMarkets: string[] = await factory.getMarketsByPlace(
      venue.placeId,
    );

    for (const m of venue.markets) {
      const resolveTimestamp = isoToUnixUtcMidnight(m.resolveDate);

      // Check if market already exists (same venue/type/date)
      let alreadyExists = false;
      if (existingMarkets.length > 0) {
        const MarketABI = [
          "function getMarketInfo() view returns (uint8, string, uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool)",
        ];
        for (const addr of existingMarkets) {
          const market = new ethers.Contract(addr, MarketABI, provider);
          const info = await market.getMarketInfo();
          const existingType = Number(info[0]);
          const existingResolveDate = Number(info[3]);
          const expectedType = m.type === "VELOCITY" ? 0 : 1;
          if (
            existingType === expectedType &&
            existingResolveDate === resolveTimestamp
          ) {
            alreadyExists = true;
            break;
          }
        }
      }

      if (alreadyExists) {
        console.log(
          `  Skipping ${m.type} market (resolveDate=${m.resolveDate}) — already exists`,
        );
        continue;
      }

      if (m.type === "VELOCITY") {
        const tx = await factory.createVelocityMarket(
          venue.placeId,
          m.target,
          resolveTimestamp,
          data.reviewCount,
        );
        const receipt = await tx.wait();
        console.log(
          `  Created VELOCITY market: target=${m.target} resolveDate=${m.resolveDate} tx=${receipt.hash}`,
        );
      } else {
        const tx = await factory.createRatingMarket(
          venue.placeId,
          m.target,
          resolveTimestamp,
        );
        const receipt = await tx.wait();
        console.log(
          `  Created RATING market: target=${m.target} resolveDate=${m.resolveDate} tx=${receipt.hash}`,
        );
      }
    }
  }

  console.log("\nSeed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
