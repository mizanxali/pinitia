# CLAUDE.md — Pinitia

## Project Overview

Pinitia is a prediction market platform where users bet on per-star review counts of Google Maps venues. It is built as an Initia EVM appchain (Minitia) for the INITIATE Hackathon 2026.

- **Deadline**: April 15, 2026
- **Track**: Gaming & Consumer
- **VM**: EVM (Solidity)
- **Native Feature**: Auto-signing
- **Chain ID**: `pinitia-1`

## What This Project Does

Users bet on whether a specific star-bucket count for a Google Maps venue will meet a target by a resolution date. Example: "Will this restaurant have >200 five-star reviews by May 1?"

Three market types:

1. **Per-Star Threshold** — will the count for star bucket X be >= target at resolution?
2. **Per-Star Delta** — will star bucket X gain >= target new reviews between market creation and resolution?
3. **Star Ratio** — will the ratio of star bucket A to star bucket B be >= target at resolution?

Markets are binary parimutuel: bettors go LONG or SHORT, winners split the losers' pool minus 2% protocol fee.

## Market Creation Model

**Markets are operator-seeded, not user-created.** This follows the same model as Polymarket and Kalshi — the team curates and creates all markets. Users can only bet on existing markets.

This means:

- There is **no `/create` page** in the frontend
- There is **no search bar** — all venues are curated and visible on the homepage
- Markets are created via a **seed script** (`oracle/src/seed.ts`) that the operator runs after deployment
- The seed script scrapes histograms for curated venues, then calls `MarketFactory.createMarket()` for each
- The operator only curates Place IDs and market parameters in `venues.json` — the frontend fetches venue metadata (name, photos, address, rating, category) from the Google Places API at runtime
- For the hackathon demo, seed 10–15 markets on recognizable/interesting venues (viral restaurants, controversial chains, new openings)
- `MarketFactory.createMarket()` is restricted to the contract owner (operator)

### Seed Script Flow

1. Read `venues.json` — curated list of Place IDs and market parameters
2. For each venue, scrape the current histogram via Playwright
3. Write the initial histogram snapshot to Supabase
4. Call `MarketFactory.createMarket()` with the Place ID, parameters, and initial histogram snapshot
5. Log all created market addresses for verification
6. Script is idempotent — checks if a market already exists for the same venue/bucket/type combo before creating

### venues.json format

The operator only specifies Place IDs and market definitions. Venue metadata (name, image, etc.) is fetched by the frontend from the Google Places API using the Place ID.

For `THRESHOLD` and `DELTA` markets, use `starBucket` (single bucket). For `RATIO` markets, use `starBucketA` and `starBucketB` (numerator and denominator of the ratio).

```json
[
  {
    "placeId": "ChIJL2smbym5woARSNIB3tG0aOA",
    "markets": [
      {
        "type": "DELTA",
        "starBucket": 4,
        "target": 30,
        "durationDays": 14
      },
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

In the ratio example above: "Will 5-star reviews outnumber 1-star reviews by 5:1 or more in 14 days?" (`starBucketA=4` is 5-star, `starBucketB=0` is 1-star, `target=5` means ratio >= 5).

## Architecture

```
VPS (oracle service)
  ├── cron: scrape histograms via Playwright
  ├── write snapshots to Supabase
  └── post histograms on-chain for market resolution

Vercel (frontend)
  ├── read from Supabase (histogram history for progress charts)
  ├── read from chain via viem/wagmi (markets, positions, pools)
  └── read from Google Places API (venue metadata)
```

The oracle writes to two places: **Supabase** (for the frontend to read histogram history) and **on-chain** (for settlement). The frontend reads from three places: **Supabase** (histogram time-series), **the chain** (market state, user positions), and **Google Places API** (venue metadata).

## Repository Structure

```
pinitia/
├── .initia/submission.json
├── contracts/                    # Solidity contracts (Foundry)
│   ├── src/
│   │   ├── MarketFactory.sol     # Creates and indexes markets (owner-only creation)
│   │   ├── StarMarket.sol        # Individual market logic + settlement
│   │   └── HistogramOracle.sol   # Trusted oracle for posting histogram data
│   ├── test/
│   │   ├── StarMarket.t.sol
│   │   └── HistogramOracle.t.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   └── foundry.toml
├── oracle/                       # Off-chain scraper + seed service
│   ├── src/
│   │   ├── index.ts              # Cron entrypoint for resolution
│   │   ├── scraper.ts            # Playwright histogram extraction
│   │   ├── validator.ts          # Cross-check vs Places API
│   │   ├── poster.ts             # On-chain tx submission
│   │   ├── db.ts                 # Supabase client + insert/query helpers
│   │   └── seed.ts               # Market seeding script (run once after deploy)
│   ├── venues.json               # Curated Place IDs + market params (minimal, no metadata)
│   └── package.json
├── frontend/                     # Next.js 14 App Router
│   ├── src/
│   │   ├── app/                  # Pages and layouts
│   │   ├── components/
│   │   │   ├── Histogram.tsx     # Per-star bar chart with delta overlay
│   │   │   ├── ProgressChart.tsx # Time-series chart of star bucket counts (from Supabase)
│   │   │   ├── BetPanel.tsx      # Long/Short bet placement
│   │   │   ├── MarketCard.tsx    # Market summary card
│   │   │   └── VenueCard.tsx     # Venue card with name, photo, active market count
│   │   ├── providers/
│   │   │   └── AutoSignProvider.tsx
│   │   ├── hooks/
│   │   │   ├── usePlaceDetails.ts    # Fetches venue metadata from Places API by Place ID
│   │   │   └── useHistogramHistory.ts # Fetches histogram time-series from Supabase
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
| Histogram storage | Supabase (Postgres)                               |
| Scraper           | Playwright (headless Chromium)                    |
| Oracle service    | Node.js, ethers.js or viem                        |
| Charts            | Recharts                                          |
| State management  | TanStack Query                                    |

## Supabase Schema

One table stores all histogram snapshots. The oracle appends a row every time it scrapes. The frontend queries this for progress charts.

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

create index idx_snapshots_place_time
  on histogram_snapshots (place_id, scraped_at desc);
```

### Oracle writes

```typescript
// oracle/src/db.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function insertSnapshot(placeId: string, counts: number[]) {
  await supabase.from("histogram_snapshots").insert({
    place_id: placeId,
    star_1: counts[0],
    star_2: counts[1],
    star_3: counts[2],
    star_4: counts[3],
    star_5: counts[4],
  });
}
```

### Frontend reads

```typescript
// frontend/src/hooks/useHistogramHistory.ts
import { createClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function useHistogramHistory(placeId: string, since: Date) {
  return useQuery({
    queryKey: ["histogram-history", placeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("histogram_snapshots")
        .select("*")
        .eq("place_id", placeId)
        .gte("scraped_at", since.toISOString())
        .order("scraped_at", { ascending: true });
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### Supabase RLS (Row Level Security)

The `histogram_snapshots` table should be readable by anyone (anon key) but only writable by the oracle (service role key):

```sql
alter table histogram_snapshots enable row level security;

-- Anyone can read
create policy "Public read access"
  on histogram_snapshots for select
  using (true);

-- Only service role can insert (oracle uses service role key)
-- No insert policy for anon = anon can't write
```

## Smart Contracts

### MarketFactory.sol

- `createMarket(placeId, starBucket, starBucketB, marketType, target, duration, initialCounts[5])` — deploys a StarMarket. **Owner-only.** For THRESHOLD/DELTA markets, `starBucketB` is ignored (pass 0). For RATIO markets, `starBucket` is the numerator and `starBucketB` is the denominator.
- `getMarketsByPlace(placeId)` — returns market addresses for a Place ID
- `getActiveMarkets()` — returns all unresolved markets
- Maintains on-chain mappings: `placeId → address[]` and `user → market[]` (populated on bet placement)
- Enforces max 5 concurrent markets per venue

### StarMarket.sol

- `betLong() payable` / `betShort() payable` — place bets
- `resolve(uint256[5] finalCounts)` — oracle-only; evaluates win condition
- `claim()` — winners withdraw proportional share minus 2% fee
- `getMarketInfo()` — returns all market metadata in one view call (includes starBucket, starBucketB, marketType, target, initialCounts, etc.)
- `getUserPosition(address)` — returns user's positions and claimable amount

Win condition logic per market type:

- Threshold: `finalCounts[starBucket] >= target`
- Delta: `finalCounts[starBucket] - initialCounts[starBucket] >= target`
- Ratio: `(finalCounts[starBucketA] * PRECISION) / finalCounts[starBucketB] >= target * PRECISION`

### HistogramOracle.sol

- `postHistogram(placeId, uint256[5] counts)` — posts full histogram, triggers resolve on eligible markets
- `batchPost(placeIds[], counts[][])` — batch resolution
- Only callable by the authorized oracle address

### Contract Design Principles

- **No custom indexer needed** — contracts store all query-able state on-chain (place→markets mapping, user→markets mapping, active markets array)
- **Market creation is owner-only** — `createMarket` has an `onlyOwner` modifier. Only the operator (deployer) can create markets.
- Frontend reads via view functions + `eth_getLogs` for events
- Events emitted: `MarketCreated`, `BetPlaced`, `MarketResolved`, `WinningsClaimed`
- Use `uint256` scaled by 1e18 for INIT amounts
- Star bucket is a `uint8` (0=1star, 1=2star, 2=3star, 3=4star, 4=5star)
- Market type is an enum: `THRESHOLD`, `DELTA`, `RATIO`
- For RATIO markets, the contract stores both `starBucketA` (numerator) and `starBucketB` (denominator)

## Oracle / Scraper

### How the scraper works

1. Query on-chain for markets within 1 hour of resolution, extract unique Place IDs
2. Launch Playwright, navigate to Google Maps place page: `https://www.google.com/maps/place/?q=place_id:{PLACE_ID}`
3. Wait for the review histogram to render
4. Extract per-star counts from the histogram bar aria-labels (e.g., `"247, 5 stars"`)
5. Validate: sum of star counts should ≈ `userRatingCount` from Places API (reject if >5% discrepancy)
6. Write the snapshot to Supabase (`histogram_snapshots` table)
7. Post on-chain via `HistogramOracle.postHistogram()` or `batchPost()`

### Scraper configuration

- Runs on cron every 10 minutes
- Sequential scraping with 3-second delays between places
- Retries 3x on failure, then falls back to latest Supabase snapshot
- Signing key stored as environment variable

### When the oracle scrapes

The oracle doesn't only scrape at resolution time. It scrapes **all active venues on every cron tick** so the Supabase time-series builds up continuously. This gives the frontend progress chart data points every 10 minutes throughout the market's lifetime. At resolution, the latest scrape is used for on-chain posting.

### Snapshot flow for delta markets

When seeding a delta market, the seed script scrapes the histogram for the venue first, writes it to Supabase, then passes the counts as `initialCounts` to `MarketFactory.createMarket()`. These are stored immutably in the StarMarket contract. At resolution, the oracle scrapes again and the contract computes the delta.

## Frontend

### Pages

| Route               | Purpose                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `/`                 | Homepage showing all curated venues as cards (metadata fetched from Places API by Place ID) |
| `/venue/[placeId]`  | Venue detail: live histogram, progress chart (from Supabase), active markets, bet CTAs      |
| `/market/[address]` | Market detail: histogram snapshot vs current, progress chart, pools, countdown, bet panel   |
| `/portfolio`        | User's positions, claimable winnings, PnL history                                           |
| `/leaderboard`      | Top traders by PnL, .init usernames                                                         |

**Note:** There is no `/create` page and no search bar. All venues are curated by the operator in `venues.json` (Place IDs only). The frontend fetches venue metadata from the Google Places API.

### Venue Metadata Fetching

The frontend reads the list of Place IDs from `venues.json` (imported statically). For each Place ID, it calls the Google Places API (New) via the Maps JavaScript API Places library to fetch:

- `displayName` — venue name
- `formattedAddress` — address
- `photos` — venue images
- `rating` — overall star rating
- `userRatingCount` — total number of reviews
- `primaryType` — venue category (e.g., "restaurant", "cafe")
- `location` — lat/lng for optional map display

```typescript
// hooks/usePlaceDetails.ts
const place = new google.maps.places.Place({ id: placeId });
await place.fetchFields({
  fields: [
    "displayName",
    "formattedAddress",
    "photos",
    "rating",
    "userRatingCount",
    "primaryType",
    "location",
  ],
});
```

Results are cached via TanStack Query with a long stale time (venue metadata doesn't change frequently).

### Homepage Layout

The homepage displays all curated venues as a grid of cards. Each card shows:

- Venue name and category (fetched from Places API)
- Venue photo (fetched from Places API)
- Overall rating and total review count
- Number of active markets (from on-chain data)
- Click-through to `/venue/[placeId]`

### Progress Chart Component

The `/venue/[placeId]` and `/market/[address]` pages display a time-series line chart showing how each star bucket's count has moved over time. Data is fetched from Supabase via `useHistogramHistory`. For a specific market, the chart highlights the target bucket with a horizontal target line. Rendered with Recharts.

### Histogram UI Component

The signature visual: 5 horizontal bars (one per star), showing current count with a proportional fill. For delta markets, a dotted outline shows the initial snapshot and solid fill shows current count. Color: green for target bucket, gray for others, red if target at risk. For ratio markets, both buckets A and B are highlighted.

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
ORACLE_PRIVATE_KEY=           # EOA private key for posting histograms + seeding markets
MINITIA_RPC_URL=              # EVM JSON-RPC endpoint
HISTOGRAM_ORACLE_ADDRESS=     # Deployed HistogramOracle contract address
MARKET_FACTORY_ADDRESS=       # Deployed MarketFactory contract address
GOOGLE_PLACES_API_KEY=        # For validation cross-check (server-side only)
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
npx playwright install chromium  # Install browser
npm run dev                      # Run resolution cron in dev mode
npm run scrape -- --place-id "ChIJ..."  # Test single place scrape
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
2. Set the oracle address on HistogramOracle
3. Set up Supabase (schema + RLS)
4. Run `npm run seed` to scrape histograms, write to Supabase, and create all markets
5. Verify markets on-chain via `cast call`
6. Start the oracle cron (`npm run dev`) — scrapes all active venues every 10 min, writes to Supabase + posts on-chain at resolution
7. Start the frontend (`npm run dev`)

## Key Decisions

1. **Operator-seeded markets** — follows Polymarket/Kalshi model. No user-created markets. No `/create` page. Simpler to build, better demo experience (app is pre-populated), and the operator controls which venues the scraper needs to hit.
2. **Minimal venues.json, metadata from Places API** — the operator only curates Place IDs and market parameters. Venue name, photos, address, rating, and category are fetched at runtime from the Google Places API. This keeps `venues.json` clean and avoids stale metadata.
3. **No search bar** — all venues are curated and displayed on the homepage. No Places Autocomplete needed.
4. **Supabase for histogram time-series** — the oracle writes histogram snapshots to Supabase on every cron tick. The frontend reads directly from Supabase for progress charts. No Express API needed on the VPS, no JSON file cache. Supabase free tier is more than enough.
5. **No custom indexer** — use on-chain view functions + eth_getLogs. Contracts maintain placeId→markets and user→markets mappings.
6. **Playwright over API for histogram** — the per-star breakdown is not in the Places API. Scraping is the only option. Use aria-label selectors (most stable).
7. **Trusted single oracle for hackathon** — acceptable trade-off. Roadmap: multi-sig → decentralized scraper network.
8. **Parimutuel over AMM** — simpler to implement, no liquidity bootstrapping needed, works well for binary markets.
9. **Simple auto-sign boolean** — the boolean `enableAutoSign` auto-detects EVM and grants `/minievm.evm.v1.MsgCall`. No need for explicit per-chain config unless we add multi-chain later.
10. **Delta markets as primary** — they have the most movement and narrative energy. Threshold and Ratio are secondary market types.

## Submission Checklist

- [ ] Contracts deployed on pinitia-1 Minitia
- [ ] Markets seeded via seed script (10–15 markets across multiple venues)
- [ ] Supabase schema created with RLS enabled
- [ ] Frontend uses InterwovenKit for wallet connection
- [ ] Auto-signing works for bet placement (3+ bets without popup)
- [ ] Oracle scrapes and resolves at least 1 market
- [ ] Progress chart displays histogram history from Supabase
- [ ] `.initia/submission.json` with all required fields
- [ ] `README.md` with Initia Hackathon Submission section
- [ ] Demo video (1-3 min): connect → auto-sign → browse histogram → bet → resolve → claim
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
  "core_logic_path": "contracts/src/StarMarket.sol",
  "native_feature_frontend_path": "frontend/src/providers/AutoSignProvider.tsx",
  "demo_video_url": "https://youtu.be/..."
}
```

## Common Issues

- **Playwright can't find histogram**: Google Maps may require accepting cookies. Add a cookie-dismiss step in the scraper. Also check that the place actually has reviews.
- **Auto-sign not working**: Ensure `defaultChainId` is set to `pinitia-1` (the Cosmos chain ID), not the EVM numeric chain ID.
- **Contract deployment fails**: Check gas station account has sufficient balance on the Minitia. Fund via `minitiad tx bank send gas-station init1ukcngvyweqhdd58xcg3uqdhj3zxtkj4cdq6wa9 1000000umin`.
- **eth_getLogs returns empty**: The local EVM JSON-RPC may lag behind block production. Add a short delay or poll with retry.
- **Seed script fails midway**: The script is idempotent — it checks if a market already exists for the same venue/bucket/type combo before creating. Safe to re-run.
- **Places API returns no photos**: Some venues have no photos in the Places API. Use a placeholder image in the VenueCard component.
- **Supabase RLS blocking writes**: Make sure the oracle uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS), not the anon key.
- **Progress chart has gaps**: If the oracle was down, there will be gaps in the time-series. The frontend chart should connect points with lines and not break on missing intervals.
