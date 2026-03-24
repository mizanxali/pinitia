# CLAUDE.md — Pinitia

Prediction markets on Google Maps venues. Users bet LONG/SHORT on review velocity or rating movement. Binary parimutuel — winners split losers' pool minus 2% fee. Oracle uses official Google Places API (`rating` + `userRatingCount`). Markets are operator-seeded, resolve on specific dates.

## Market Types

1. **VELOCITY** — `finalReviewCount - initialReviewCount >= target`
2. **RATING** — `finalRating >= target` (rating scaled by 1e2, e.g. 4.2 → 420)

## Architecture

```
VPS (oracle, hourly cron)
  fetch Places API ──write──▶  Supabase (place_snapshots)  ◀──read── frontend
  (rating + count)  ──post──▶  PlaceOracle contract         ◀──read── frontend
```

## Repo Structure

```
pinitia/
├── contracts/src/         MarketFactory.sol, Market.sol, PlaceOracle.sol
├── contracts/test/        Market.t.sol, PlaceOracle.t.sol
├── contracts/script/      Deploy.s.sol
├── oracle/src/            index.ts, fetcher.ts, poster.ts, db.ts, seed.ts
├── oracle/venues.json
└── frontend/              Next.js 14 (built separately)
```

## Contracts

### MarketFactory.sol

- `createVelocityMarket(placeId, target, resolveDate, initialReviewCount)` — owner-only
- `createRatingMarket(placeId, target, resolveDate)` — owner-only, target scaled 1e2
- `getMarketsByPlace(placeId)` → `address[]`
- `getActiveMarkets()` → `address[]`
- Mappings: `placeId → address[]`, `user → market[]` (populated on bet)
- Events: `MarketCreated`

### Market.sol

- `betLong() payable` / `betShort() payable`
- `resolve(uint256 finalRating, uint256 finalReviewCount)` — oracle-only, requires `block.timestamp >= resolveDate`
- `claim()` — proportional share minus 2% fee
- `getMarketInfo()` → (marketType, placeId, target, resolveDate, pools, initialReviewCount, finalRating, finalReviewCount, resolved)
- `getUserPosition(address)` → (long, short, claimable)
- Events: `BetPlaced`, `MarketResolved`, `WinningsClaimed`

### PlaceOracle.sol

- `postPlaceData(placeId, uint256 rating, uint256 reviewCount)` — triggers resolve on eligible markets
- `batchPost(placeIds[], ratings[], reviewCounts[])`
- `setOracle(address)` — owner-only

### Conventions

- Bet amounts: `uint256` scaled 1e18
- Ratings: `uint256` scaled 1e2 (4.3 → 430)
- Review counts: `uint256` unscaled
- Resolve dates: `uint256` unix timestamp (midnight UTC)
- `enum MarketType { VELOCITY, RATING }`

## Oracle

### Pipeline (hourly cron)

1. Read active Place IDs from on-chain
2. Fetch `rating` + `userRatingCount` from Google Places API (New) for each
3. Write to Supabase `place_snapshots`
4. If `block.timestamp >= resolveDate`: post on-chain via `PlaceOracle.postPlaceData()`

### Seed Script (`seed.ts`)

1. Read `venues.json`, fetch current data from Places API
2. Write initial snapshot to Supabase
3. Call `createVelocityMarket()` or `createRatingMarket()`
4. Idempotent — skips existing venue/type/date combos

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

RLS: public read, write via service role key only.

## Environment Variables

```bash
# Oracle
ORACLE_PRIVATE_KEY=
MINITIA_RPC_URL=
PLACE_ORACLE_ADDRESS=
MARKET_FACTORY_ADDRESS=
GOOGLE_PLACES_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```
