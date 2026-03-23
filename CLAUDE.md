# CLAUDE.md — Pinitia

Prediction markets on Google Maps per-star review counts. Users bet LONG/SHORT on whether a venue's star-bucket count will meet a target by a deadline. Binary parimutuel model — winners split losers' pool minus 2% fee.

## Market Types

1. **THRESHOLD** — `finalCounts[starBucket] >= target`
2. **DELTA** — `finalCounts[starBucket] - initialCounts[starBucket] >= target`
3. **RATIO** — `(finalCounts[starBucketA] * PRECISION) / finalCounts[starBucketB] >= target * PRECISION`

## Architecture

```
VPS (oracle)                        Supabase (Postgres)           EVM Minitia (on-chain)
  scrape histograms ──write──▶  histogram_snapshots table    ◀──read── frontend (Vercel)
  via Playwright     ──post──▶  HistogramOracle contract     ◀──read── frontend (Vercel)
```

Oracle writes to Supabase (time-series for frontend charts) and on-chain (for settlement). Markets are operator-seeded, not user-created.

## Repository Structure

```
pinitia/
├── contracts/           # Solidity (Foundry)
│   ├── src/
│   │   ├── MarketFactory.sol
│   │   ├── StarMarket.sol
│   │   └── HistogramOracle.sol
│   ├── test/
│   └── foundry.toml
├── oracle/              # Node.js scraper + seed service
│   ├── src/
│   │   ├── index.ts     # Cron entrypoint
│   │   ├── scraper.ts   # Playwright histogram extraction
│   │   ├── validator.ts # Cross-check vs Places API
│   │   ├── poster.ts    # On-chain tx submission
│   │   ├── db.ts        # Supabase client
│   │   └── seed.ts      # Seed markets from venues.json
│   └── venues.json
└── frontend/            # Next.js 14 (built separately, not by Claude Code)
```

## Smart Contracts

### MarketFactory.sol

- `createMarket(placeId, starBucket, starBucketB, marketType, target, duration, initialCounts[5])` — deploys StarMarket. **Owner-only.** For THRESHOLD/DELTA, `starBucketB` ignored (pass 0). For RATIO, `starBucket` = numerator, `starBucketB` = denominator.
- `getMarketsByPlace(placeId)` → `address[]`
- `getActiveMarkets()` → `address[]`
- On-chain mappings: `placeId → address[]`, `user → market[]` (populated on bet)
- Max 5 concurrent markets per venue
- Events: `MarketCreated`

### StarMarket.sol

- `betLong() payable` / `betShort() payable`
- `resolve(uint256[5] finalCounts)` — oracle-only
- `claim()` — winners get proportional share minus 2% fee
- `getMarketInfo()` — view returning all metadata (starBucket, starBucketB, marketType, target, expiry, pools, initialCounts, finalCounts, resolved)
- `getUserPosition(address)` — view returning long/short amounts + claimable
- Events: `BetPlaced`, `MarketResolved`, `WinningsClaimed`

### HistogramOracle.sol

- `postHistogram(placeId, uint256[5] counts)` — posts histogram, triggers resolve on eligible markets for that placeId
- `batchPost(placeIds[], counts[][])` — batch resolution
- `setOracle(address)` — owner-only
- Only authorized oracle address can post

### Contract Conventions

- `uint256` scaled by 1e18 for INIT amounts
- Star bucket: `uint8` (0=1star, 1=2star, 2=3star, 3=4star, 4=5star)
- Market type: `enum MarketType { THRESHOLD, DELTA, RATIO }`
- No custom indexer — frontend reads via view functions + `eth_getLogs`

## Oracle Service

### Scraper Pipeline

1. Read active Place IDs from on-chain (all active venues, not just expiring ones — to build continuous time-series)
2. Playwright: navigate to `https://www.google.com/maps/place/?q=place_id:{PLACE_ID}`
3. Extract per-star counts from histogram bar aria-labels (e.g., `"247, 5 stars"`)
4. Validate: sum ≈ `userRatingCount` from Places API (reject if >5% discrepancy)
5. Write snapshot to Supabase
6. If market is at/past resolution: post on-chain via `HistogramOracle.postHistogram()`

### Scraper Config

- Cron every 10 minutes
- Sequential with 3s delays between places
- 3x retry, fallback to latest Supabase snapshot
- Cookie-dismiss step needed for Google Maps

### Seed Script (`seed.ts`)

1. Read `venues.json`
2. Scrape histogram for each venue
3. Write initial snapshot to Supabase
4. Call `MarketFactory.createMarket()` with params + initial counts
5. Idempotent — skip if market already exists for same venue/bucket/type

### venues.json

```json
[
  {
    "placeId": "ChIJL2smbym5woARSNIB3tG0aOA",
    "markets": [
      { "type": "DELTA", "starBucket": 4, "target": 30, "durationDays": 14 },
      {
        "type": "THRESHOLD",
        "starBucket": 0,
        "target": 50,
        "durationDays": 30
      },
      {
        "type": "RATIO",
        "starBucketA": 4,
        "starBucketB": 0,
        "target": 5,
        "durationDays": 14
      }
    ]
  }
]
```

## Supabase

```sql
create table histogram_snapshots (
  id bigint generated always as identity primary key,
  place_id text not null,
  star_1 integer not null,
  star_2 integer not null,
  star_3 integer not null,
  star_4 integer not null,
  star_5 integer not null,
  scraped_at timestamptz not null default now()
);

create index idx_snapshots_place_time on histogram_snapshots (place_id, scraped_at desc);
```

RLS: public read (anon key), write via service role key only.

## Environment Variables (Oracle)

```bash
ORACLE_PRIVATE_KEY=
MINITIA_RPC_URL=
HISTOGRAM_ORACLE_ADDRESS=
MARKET_FACTORY_ADDRESS=
GOOGLE_PLACES_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```
