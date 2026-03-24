# CLAUDE.md — Pinitia

Prediction markets on Google Maps venues using official Places API data (`rating` + `userRatingCount`). Users bet LONG/SHORT on review velocity or rating movement. Binary parimutuel model — winners split losers' pool minus 2% fee.

## Market Types

All markets resolve using two fields from the Google Places API (New): `rating` (float) and `userRatingCount` (integer). Markets resolve on a specific date (midnight UTC).

1. **VELOCITY** — will the venue gain >= `target` new reviews by the resolution date?
   - Win condition: `finalReviewCount - initialReviewCount >= target`
   - Example: "Will this place gain 50+ reviews by April 10, 2026?"

2. **RATING** — will the venue's rating be >= `target` on the resolution date?
   - Win condition: `finalRating >= target` (target stored as uint256 scaled by 1e2, e.g., 4.2 → 420)
   - Example: "Will this new café still be above 4.0 on April 15, 2026?"

## Architecture

```
VPS (oracle)                        Supabase (Postgres)           EVM Minitia (on-chain)
  fetch Places API ──write──▶   place_snapshots table        ◀──read── frontend (Vercel)
  (rating + count)  ──post──▶   PlaceOracle contract         ◀──read── frontend (Vercel)
```

Oracle calls the Google Places API, writes snapshots to Supabase (time-series for frontend progress charts), and posts data on-chain for market resolution. No scraping — official API only. Markets are operator-seeded, not user-created.

## Repository Structure

```
pinitia/
├── contracts/           # Solidity (Foundry)
│   ├── src/
│   │   ├── MarketFactory.sol
│   │   ├── Market.sol
│   │   └── PlaceOracle.sol
│   ├── test/
│   └── foundry.toml
├── oracle/              # Node.js fetcher + seed service
│   ├── src/
│   │   ├── index.ts     # Cron entrypoint
│   │   ├── fetcher.ts   # Google Places API calls
│   │   ├── poster.ts    # On-chain tx submission
│   │   ├── db.ts        # Supabase client
│   │   └── seed.ts      # Seed markets from venues.json
│   └── venues.json
└── frontend/            # Next.js 14 (built separately, not by Claude Code)
```

## Smart Contracts

### MarketFactory.sol

- `createVelocityMarket(placeId, target, resolveDate, initialReviewCount)` — **Owner-only.** `resolveDate` is a unix timestamp (midnight UTC of the resolution date).
- `createRatingMarket(placeId, target, resolveDate)` — **Owner-only.** `target` is rating scaled by 1e2 (e.g., 420 = 4.2 stars).
- `getMarketsByPlace(placeId)` → `address[]`
- `getActiveMarkets()` → `address[]`
- On-chain mappings: `placeId → address[]`, `user → market[]` (populated on bet)
- Max 5 concurrent markets per venue
- Events: `MarketCreated`

### Market.sol

- `betLong() payable` / `betShort() payable`
- `resolve(uint256 finalRating, uint256 finalReviewCount)` — oracle-only, callable only when `block.timestamp >= resolveDate`
- `claim()` — winners get proportional share minus 2% fee
- `getMarketInfo()` — view returning all metadata (marketType, placeId, target, resolveDate, pools, initialReviewCount, finalRating, finalReviewCount, resolved)
- `getUserPosition(address)` — view returning long/short amounts + claimable
- Events: `BetPlaced`, `MarketResolved`, `WinningsClaimed`

### PlaceOracle.sol

- `postPlaceData(placeId, uint256 rating, uint256 reviewCount)` — posts data, triggers resolve on eligible markets (those where `block.timestamp >= resolveDate`) for that placeId. `rating` scaled by 1e2.
- `batchPost(placeIds[], ratings[], reviewCounts[])` — batch posting
- `setOracle(address)` — owner-only
- Only authorized oracle address can post

### Contract Conventions

- `uint256` scaled by 1e18 for INIT bet amounts
- `uint256` scaled by 1e2 for ratings (4.3 stars → 430)
- `uint256` unscaled for review counts
- `uint256` unix timestamp for resolution dates
- Market type: `enum MarketType { VELOCITY, RATING }`
- No custom indexer — frontend reads via view functions + `eth_getLogs`

## Oracle Service

### Fetcher Pipeline

1. Read all unique Place IDs from on-chain active markets
2. For each Place ID, call Google Places API (New) — Place Details endpoint with fields `rating,userRatingCount`
3. Write snapshot to Supabase (`place_snapshots` table)
4. For markets where current time >= resolveDate: post on-chain via `PlaceOracle.postPlaceData()`

### Oracle Config

- Cron every hour
- Sequential API calls (Places API has generous rate limits — no delays needed)
- Fallback to latest Supabase snapshot if API call fails

### Seed Script (`seed.ts`)

1. Read `venues.json`
2. Fetch current `rating` + `userRatingCount` for each venue from Places API
3. Write initial snapshot to Supabase
4. Call `MarketFactory.createVelocityMarket()` or `createRatingMarket()` with params + initial values
5. Idempotent — skip if market already exists for same venue/type/date combo

### venues.json

```json
[
  {
    "placeId": "ChIJL2smbym5woARSNIB3tG0aOA",
    "markets": [
      { "type": "VELOCITY", "target": 50, "resolveDate": "2026-04-10" },
      { "type": "RATING", "target": 420, "resolveDate": "2026-04-15" }
    ]
  }
]
```

`resolveDate` is an ISO date string. The seed script converts it to a unix timestamp (midnight UTC) when calling the contract.

## Supabase

```sql
create table place_snapshots (
  id bigint generated always as identity primary key,
  place_id text not null,
  rating numeric(3,2) not null,
  review_count integer not null,
  fetched_at timestamptz not null default now()
);

create index idx_snapshots_place_time on place_snapshots (place_id, fetched_at desc);
```

RLS: public read (anon key), write via service role key only.

## Environment Variables (Oracle)

```bash
ORACLE_PRIVATE_KEY=
MINITIA_RPC_URL=
PLACE_ORACLE_ADDRESS=
MARKET_FACTORY_ADDRESS=
GOOGLE_PLACES_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```
