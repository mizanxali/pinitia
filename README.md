# README.md — Pinitia

## Project Overview

Pinitia is a prediction market platform where users bet on Google Maps venue metrics — review velocity and rating movement. It is built as an Initia EVM appchain (Minitia) for the INITIATE Hackathon 2026.

- **Deadline**: April 15, 2026
- **Track**: Gaming & Consumer
- **VM**: EVM (Solidity)
- **Native Feature**: Auto-signing
- **Chain ID**: `pinitia-1`

## What This Project Does

Users bet on whether a Google Maps venue's review count or rating will meet a target by a specific resolution date. Markets are binary parimutuel — bettors go LONG or SHORT, winners split the losers' pool minus 2% protocol fee.

Two market types, both resolved using official Google Places API data (`rating` + `userRatingCount`):

1. **VELOCITY** — will the venue gain >= target new reviews by the resolution date?
   - Example: "Will this place gain 50+ reviews by April 10, 2026?"
   - Win condition: `finalReviewCount - initialReviewCount >= target`

2. **RATING** — will the venue's rating be >= target on the resolution date?
   - Example: "Will this new café still be above 4.0 on April 15, 2026?"
   - Win condition: `finalRating >= target`

## Market Creation Model

**Markets are operator-seeded, not user-created.** This follows the same model as Polymarket and Kalshi — the team curates and creates all markets. Users can only bet on existing markets.

This means:

- There is **no `/create` page** in the frontend
- There is **no search bar** — all venues are curated and visible on the homepage
- Markets are created via a **seed script** (`oracle/src/seed.ts`) that the operator runs after deployment
- The seed script fetches current venue data from the Google Places API, then calls `MarketFactory.createVelocityMarket()` or `createRatingMarket()` for each
- The operator only curates Place IDs and market parameters in `venues.json` — the frontend fetches venue metadata (name, photos, address, rating, category) from the Google Places API at runtime
- For the hackathon demo, seed 10–15 markets on recognizable/interesting venues (viral restaurants, controversial chains, new openings)
- Market creation functions are restricted to the contract owner (operator)

### Seed Script Flow

1. Read `venues.json` — curated list of Place IDs and market parameters
2. For each venue, fetch current `rating` + `userRatingCount` from Google Places API
3. Write the initial snapshot to Supabase
4. Call `MarketFactory.createVelocityMarket()` or `createRatingMarket()` with the Place ID, parameters, and initial values
5. Log all created market addresses for verification
6. Script is idempotent — checks if a market already exists for the same venue/type/date combo before creating

### venues.json format

The operator only specifies Place IDs and market definitions. Venue metadata (name, image, etc.) is fetched by the frontend from the Google Places API using the Place ID. `resolveDate` is an ISO date string — the seed script converts it to a unix timestamp (midnight UTC) when calling the contract.

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

For RATING markets, `target` is the rating scaled by 100 (e.g., 4.2 stars → 420).

Place IDs for curated venues can be obtained from the [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id).

## Architecture

```
VPS (oracle service)
  ├── cron (hourly): fetch rating + reviewCount from Google Places API
  ├── write snapshots to Supabase
  └── post data on-chain for market resolution (when resolveDate is reached)

Vercel (frontend)
  ├── read from Supabase (place snapshot history for progress charts)
  ├── read from chain via viem/wagmi (markets, positions, pools)
  └── read from Google Places API (venue metadata: name, photos, address, category)
```

The oracle writes to two places: **Supabase** (for the frontend to read snapshot history) and **on-chain** (for settlement). The frontend reads from three places: **Supabase** (time-series data), **the chain** (market state, user positions), and **Google Places API** (venue metadata).

No scraping, no Playwright, no headless browser — the oracle just calls the official Google Places API.

## Repository Structure

```
pinitia/
├── .initia/submission.json
├── contracts/                    # Solidity contracts (Foundry)
│   ├── src/
│   │   ├── MarketFactory.sol     # Creates and indexes markets (owner-only creation)
│   │   ├── Market.sol            # Individual market logic + settlement
│   │   └── PlaceOracle.sol       # Trusted oracle for posting place data
│   ├── test/
│   │   ├── Market.t.sol
│   │   └── PlaceOracle.t.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   └── foundry.toml
├── oracle/                       # Off-chain fetcher + seed service
│   ├── src/
│   │   ├── index.ts              # Cron entrypoint (hourly)
│   │   ├── fetcher.ts            # Google Places API calls
│   │   ├── poster.ts             # On-chain tx submission
│   │   ├── db.ts                 # Supabase client + insert/query helpers
│   │   └── seed.ts               # Market seeding script (run once after deploy)
│   ├── venues.json               # Curated Place IDs + market params
│   └── package.json
├── frontend/                     # Next.js 14 App Router
│   ├── src/
│   │   ├── app/                  # Pages and layouts
│   │   ├── components/
│   │   │   ├── ProgressChart.tsx # Time-series chart (rating or review count over time)
│   │   │   ├── BetPanel.tsx      # Long/Short bet placement
│   │   │   ├── MarketCard.tsx    # Market summary card
│   │   │   └── VenueCard.tsx     # Venue card with name, photo, active market count
│   │   ├── providers/
│   │   │   └── AutoSignProvider.tsx
│   │   ├── hooks/
│   │   │   ├── usePlaceDetails.ts      # Fetches venue metadata from Places API by Place ID
│   │   │   └── useSnapshotHistory.ts   # Fetches place snapshot time-series from Supabase
│   │   └── lib/
│   │       ├── contracts.ts      # ABIs, addresses, contract helpers
│   │       ├── supabase.ts       # Supabase client for frontend
│   │       └── venues.ts         # Import venues.json, types for venue + market definitions
│   └── package.json
└── README.md
```

## Tech Stack

| Layer             | Technology                                        |
| ----------------- | ------------------------------------------------- |
| Contracts         | Solidity, Foundry (forge, cast)                   |
| Frontend          | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Wallet            | @initia/interwovenkit-react (EVM integration)     |
| Chain interaction | viem + wagmi                                      |
| Venue metadata    | Google Places API (New) via Places JS Library     |
| Snapshot storage  | Supabase (Postgres)                               |
| Oracle service    | Node.js, viem                                     |
| Charts            | Recharts                                          |
| State management  | TanStack Query                                    |

## Supabase Schema

One table stores all place snapshots. The oracle appends a row every hour. The frontend queries this for progress charts.

```sql
create table place_snapshots (
  id bigint generated always as identity primary key,
  place_id text not null,
  rating numeric(3,2) not null,
  review_count integer not null,
  fetched_at timestamptz not null default now()
);

create index idx_snapshots_place_time
  on place_snapshots (place_id, fetched_at desc);
```

### Supabase RLS (Row Level Security)

```sql
alter table place_snapshots enable row level security;

-- Anyone can read
create policy "Public read access"
  on place_snapshots for select
  using (true);

-- Only service role can insert (oracle uses service role key)
-- No insert policy for anon = anon can't write
```

## Smart Contracts

### MarketFactory.sol

- `createVelocityMarket(placeId, target, resolveDate, initialReviewCount)` — **Owner-only.** `resolveDate` is a unix timestamp (midnight UTC).
- `createRatingMarket(placeId, target, resolveDate)` — **Owner-only.** `target` is rating scaled by 1e2 (e.g., 420 = 4.2 stars).
- `getMarketsByPlace(placeId)` — returns market addresses for a Place ID
- `getActiveMarkets()` — returns all unresolved markets
- Maintains on-chain mappings: `placeId → address[]` and `user → market[]` (populated on bet placement)
- Max 5 concurrent markets per venue
- Events: `MarketCreated`

### Market.sol

- `betLong() payable` / `betShort() payable` — place bets
- `resolve(uint256 finalRating, uint256 finalReviewCount)` — oracle-only, callable only when `block.timestamp >= resolveDate`
- `claim()` — winners withdraw proportional share minus 2% fee
- `getMarketInfo()` — returns all market metadata in one view call (marketType, placeId, target, resolveDate, pools, initialReviewCount, finalRating, finalReviewCount, resolved)
- `getUserPosition(address)` — returns user's long/short amounts and claimable
- Events: `BetPlaced`, `MarketResolved`, `WinningsClaimed`

Win condition logic:

- VELOCITY: `finalReviewCount - initialReviewCount >= target`
- RATING: `finalRating >= target`

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
- ~50 lines of code total — just API calls, no browser, no scraping

## Frontend

### Pages

| Route               | Purpose                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `/`                 | Homepage showing all curated venues as cards (metadata fetched from Places API by Place ID)           |
| `/venue/[placeId]`  | Venue detail: current rating + review count, progress chart (from Supabase), active markets, bet CTAs |
| `/market/[address]` | Market detail: progress chart with target line, pool sizes, countdown to resolveDate, bet panel       |
| `/portfolio`        | User's positions, claimable winnings, PnL history                                                     |
| `/leaderboard`      | Top traders by PnL, .init usernames                                                                   |

Results are cached via TanStack Query with a long stale time (venue metadata doesn't change frequently).

### Homepage Layout

The homepage displays all curated venues as a grid of cards. Each card shows:

- Venue name and category (fetched from Places API)
- Venue photo (fetched from Places API)
- Overall rating and total review count
- Number of active markets (from on-chain data)
- Click-through to `/venue/[placeId]`

### Progress Chart Component

The `/venue/[placeId]` and `/market/[address]` pages display a time-series line chart showing how the venue's rating or review count has moved over time. Data is fetched from Supabase via `useSnapshotHistory`. For a specific market, the chart highlights the target with a horizontal line (e.g., target review count for VELOCITY, target rating for RATING). Rendered with Recharts.

### InterwovenKit EVM Integration

Provider setup for the EVM Minitia:

```tsx
// providers.tsx
import { createConfig, http, WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  initiaPrivyWalletConnector,
  injectStyles,
  InterwovenKitProvider,
  TESTNET,
} from "@initia/interwovenkit-react";
import interwovenKitStyles from "@initia/interwovenkit-react/styles.js";

const pinitiaChain = {
  id: "pinitia-1",
  name: "Pinitia",
  nativeCurrency: { name: "MIN", symbol: "MIN", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://localhost:8545"] }, // Local dev; update for testnet
  },
};

const wagmiConfig = createConfig({
  connectors: [initiaPrivyWalletConnector],
  chains: [pinitiaChain],
  transports: { [pinitiaChain.id]: http() },
});

const queryClient = new QueryClient();
```

### Auto-signing Configuration

For the EVM Minitia, use the simple boolean config — it auto-grants `/minievm.evm.v1.MsgCall` which covers all contract calls (betLong, betShort, claim):

```tsx
<InterwovenKitProvider {...TESTNET} defaultChainId="pinitia-1" enableAutoSign>
  {children}
</InterwovenKitProvider>
```

If you need explicit control later:

```tsx
enableAutoSign={{
  'pinitia-1': ['/minievm.evm.v1.MsgCall'],
}}
```

## Initia Appchain useful endpoints

- Local rollup indexer: `http://localhost:8080`
- Local rollup RPC: `http://localhost:26657`
- Local rollup REST: `http://localhost:1317`
- Local EVM JSON-RPC: `http://localhost:8545`
- L1 testnet RPC: `https://rpc.testnet.initia.xyz`
- L1 testnet REST: `https://rest.testnet.initia.xyz`
- Faucet: `https://faucet.testnet.initia.xyz`

## Environment Variables

```bash
# Oracle service (also used by seed script)
ORACLE_PRIVATE_KEY=           # EOA private key for posting data + seeding markets
MINITIA_RPC_URL=              # EVM JSON-RPC endpoint
PLACE_ORACLE_ADDRESS=         # Deployed PlaceOracle contract address
MARKET_FACTORY_ADDRESS=       # Deployed MarketFactory contract address
GOOGLE_PLACES_API_KEY=        # Google Places API key (server-side)
SUPABASE_URL=                 # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=    # Supabase service role key (oracle writes)

# Frontend
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=   # Google Maps JS API key (for Places API venue metadata)
NEXT_PUBLIC_MINITIA_RPC_URL=       # EVM JSON-RPC endpoint
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=
NEXT_PUBLIC_CHAIN_ID=pinitia-1
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon key (frontend reads only)
```

## Development Workflow

### Contracts

```bash
cd contracts
forge build                     # Compile
forge test                      # Run tests
forge test -vvvv                # Verbose test output
forge script script/Deploy.s.sol --rpc-url $MINITIA_RPC_URL --broadcast  # Deploy
```

### Oracle service

```bash
cd oracle
npm install
npm run dev                      # Run hourly cron in dev mode
npm run fetch -- --place-id "ChIJ..."  # Test single place fetch
npm run seed                     # Seed markets from venues.json (run once after deploy)
```

### Frontend

```bash
cd frontend
npm install
npm run dev                      # http://localhost:3000
```

### Supabase setup

1. Create a new Supabase project
2. Run the schema SQL (see Supabase Schema section above)
3. Enable RLS with public read policy
4. Copy the project URL, anon key, and service role key to env vars

### Post-deploy workflow

1. Deploy contracts via Foundry
2. Set the oracle address on PlaceOracle
3. Set up Supabase (schema + RLS)
4. Run `npm run seed` to fetch place data, write to Supabase, and create all markets
5. Verify markets on-chain via `cast call`
6. Start the oracle cron (`npm run dev`) — fetches all active venues every hour, writes to Supabase + posts on-chain at resolution
7. Start the frontend (`npm run dev`)

## Key Decisions

1. **Official Google Places API only** — no scraping, no Playwright, no anti-bot battles. The oracle fetches `rating` and `userRatingCount` from the official API. Simple, reliable, TOS-compliant.
2. **Two market types: VELOCITY + RATING** — review velocity (count delta) is fast-moving and bettable. Rating movement works on newer/smaller venues. Both resolve using official API data.
3. **Date-based resolution** — markets resolve on a specific date (midnight UTC), not after a duration. Clearer for users, simpler for the oracle.
4. **Hourly oracle cron** — markets resolve on a day basis, so hourly polling is plenty. Gives 24 data points per day for progress charts without burning API quota.
5. **Operator-seeded markets** — follows Polymarket/Kalshi model. No user-created markets. No `/create` page. Simpler to build, better demo experience (app is pre-populated).
6. **Minimal venues.json, metadata from Places API** — the operator only curates Place IDs and market parameters. Venue name, photos, address, rating, and category are fetched at runtime from the Google Places API.
7. **No search bar** — all venues are curated and displayed on the homepage.
8. **Supabase for time-series** — the oracle writes place snapshots to Supabase every hour. The frontend reads directly from Supabase for progress charts. No Express API needed, no file cache.
9. **No custom indexer** — use on-chain view functions + eth_getLogs. Contracts maintain placeId→markets and user→markets mappings.
10. **Parimutuel over AMM** — simpler to implement, no liquidity bootstrapping needed, works well for binary markets.
11. **Simple auto-sign boolean** — the boolean `enableAutoSign` auto-detects EVM and grants `/minievm.evm.v1.MsgCall`.

## Submission Checklist

- [ ] Contracts deployed on pinitia-1 Minitia
- [ ] Markets seeded via seed script (10–15 markets across multiple venues)
- [ ] Supabase schema created with RLS enabled
- [ ] Frontend uses InterwovenKit for wallet connection
- [ ] Auto-signing works for bet placement (3+ bets without popup)
- [ ] Oracle fetches and resolves at least 1 market
- [ ] Progress chart displays snapshot history from Supabase
- [ ] `.initia/submission.json` with all required fields
- [ ] `README.md` with Initia Hackathon Submission section
- [ ] Demo video (1-3 min): connect → auto-sign → browse venue → bet → resolve → claim
- [ ] Public GitHub repo

### submission.json

```json
{
  "project_name": "Pinitia",
  "repo_url": "https://github.com/mizanxali/pinitia",
  "commit_sha": "<final-commit-sha>",
  "rollup_chain_id": "pinitia-1",
  "deployed_address": "<MarketFactory-address>",
  "vm": "evm",
  "native_feature": "auto-signing",
  "core_logic_path": "contracts/src/Market.sol",
  "native_feature_frontend_path": "frontend/src/providers/AutoSignProvider.tsx",
  "demo_video_url": "https://youtu.be/..."
}
```

## Common Issues

- **Auto-sign not working**: Ensure `defaultChainId` is set to `pinitia-1` (the Cosmos chain ID), not the EVM numeric chain ID.
- **Contract deployment fails**: Check gas station account has sufficient balance on the Minitia. Fund via `minitiad tx bank send gas-station <your-addr> 1000000umin`.
- **eth_getLogs returns empty**: The local EVM JSON-RPC may lag behind block production. Add a short delay or poll with retry.
- **Seed script fails midway**: The script is idempotent — it checks if a market already exists for the same venue/type/date combo before creating. Safe to re-run.
- **Places API returns no photos**: Some venues have no photos in the Places API. Use a placeholder image in the VenueCard component.
- **Supabase RLS blocking writes**: Make sure the oracle uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS), not the anon key.
- **Progress chart has gaps**: If the oracle was down, there will be gaps in the time-series. The frontend chart should connect points with lines and not break on missing intervals.
- **Google Places API quota**: Free tier gives $200/month credit. Place Details (Basic) costs $0.017 per call. At 15 venues × 24 calls/day = 360 calls/day = ~$6/month. Well within free tier.
