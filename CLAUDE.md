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

## Repository Structure

```
pinitia/
├── .initia/submission.json
├── contracts/                    # Solidity contracts (Foundry)
│   ├── src/
│   │   ├── MarketFactory.sol     # Creates and indexes markets
│   │   ├── StarMarket.sol        # Individual market logic + settlement
│   │   └── HistogramOracle.sol   # Trusted oracle for posting histogram data
│   ├── test/
│   │   ├── StarMarket.t.sol
│   │   └── HistogramOracle.t.sol
│   └── foundry.toml
├── oracle/                       # Off-chain scraper service
│   ├── src/
│   │   ├── index.ts              # Cron entrypoint
│   │   ├── scraper.ts            # Playwright histogram extraction
│   │   ├── validator.ts          # Cross-check vs Places API
│   │   └── poster.ts             # On-chain tx submission
│   ├── cache/                    # Local histogram cache (JSON)
│   └── package.json
├── frontend/                     # Next.js 14 App Router
│   ├── src/
│   │   ├── app/                  # Pages and layouts
│   │   ├── components/
│   │   │   ├── Histogram.tsx     # Per-star bar chart with delta overlay
│   │   │   ├── BetPanel.tsx      # Long/Short bet placement
│   │   │   ├── MarketCard.tsx    # Market summary card
│   │   │   └── VenueMap.tsx      # Google Maps with venue pins
│   │   ├── providers/
│   │   │   └── AutoSignProvider.tsx
│   │   ├── hooks/
│   │   └── lib/contracts.ts      # ABIs, addresses, contract helpers
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
| Maps              | Google Maps JavaScript API + Places API (New)     |
| Scraper           | Playwright (headless Chromium)                    |
| Oracle service    | Node.js, ethers.js or viem                        |
| Charts            | Recharts                                          |
| State management  | TanStack Query                                    |

## Smart Contracts

### MarketFactory.sol

- `createMarket(placeId, starBucket, marketType, target, duration, initialCounts[5])` — deploys a StarMarket
- `getMarketsByPlace(placeId)` — returns market addresses for a Place ID
- `getActiveMarkets()` — returns all unresolved markets
- Maintains on-chain mappings: `placeId → address[]` and `user → market[]` (populated on bet placement)
- Enforces max 5 concurrent markets per venue

### StarMarket.sol

- `betLong() payable` / `betShort() payable` — place bets
- `resolve(uint256[5] finalCounts)` — oracle-only; evaluates win condition
- `claim()` — winners withdraw proportional share minus 2% fee
- `getMarketInfo()` — returns all market metadata in one view call
- `getUserPosition(address)` — returns user's positions and claimable amount

Win condition logic per market type:

- Threshold: `finalCounts[starBucket] >= target`
- Delta: `finalCounts[starBucket] - initialCounts[starBucket] >= target`
- Ratio: `(finalCounts[starA] * PRECISION) / finalCounts[starB] >= targetRatio`

### HistogramOracle.sol

- `postHistogram(placeId, uint256[5] counts)` — posts full histogram, triggers resolve on eligible markets
- `batchPost(placeIds[], counts[][])` — batch resolution
- Only callable by the authorized oracle address

### Contract Design Principles

- **No custom indexer needed** — contracts store all query-able state on-chain (place→markets mapping, user→markets mapping, active markets array)
- Frontend reads via view functions + `eth_getLogs` for events
- Events emitted: `MarketCreated`, `BetPlaced`, `MarketResolved`, `WinningsClaimed`
- Use `uint256` scaled by 1e18 for INIT amounts
- Star bucket is a `uint8` (0=1star, 1=2star, 2=3star, 3=4star, 4=5star)
- Market type is an enum: `THRESHOLD`, `DELTA`, `RATIO`

## Oracle / Scraper

### How the scraper works

1. Query on-chain for markets within 1 hour of resolution, extract unique Place IDs
2. Launch Playwright, navigate to Google Maps place page: `https://www.google.com/maps/place/?q=place_id:{PLACE_ID}`
3. Wait for the review histogram to render
4. Extract per-star counts from the histogram bar aria-labels (e.g., `"247, 5 stars"`)
5. Validate: sum of star counts should ≈ `userRatingCount` from Places API (reject if >5% discrepancy)
6. Cache the histogram locally with timestamp
7. Post on-chain via `HistogramOracle.postHistogram()` or `batchPost()`

### Scraper configuration

- Runs on cron every 10 minutes
- Sequential scraping with 3-second delays between places
- Retries 3x on failure, then falls back to cached histogram
- Signing key stored as environment variable

### Snapshot flow for delta markets

When creating a delta market, the frontend calls a backend API route that triggers an immediate scrape for the Place ID. The scraped counts are passed as `initialCounts` to `MarketFactory.createMarket()` and stored immutably in the StarMarket.

## Frontend

### Pages

| Route               | Purpose                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `/`                 | Map explore page with venue pins, active market counts, search                            |
| `/venue/[placeId]`  | Venue detail: live histogram, active markets per bucket, create market CTA                |
| `/market/[address]` | Market detail: histogram snapshot vs current (delta overlay), pools, countdown, bet panel |
| `/portfolio`        | User's positions, claimable winnings, PnL history                                         |
| `/leaderboard`      | Top traders by PnL, .init usernames                                                       |
| `/create`           | Create market flow: search → histogram → pick bucket/type/target/duration                 |

### Histogram UI Component

The signature visual: 5 horizontal bars (one per star), showing current count with a proportional fill. For delta markets, a dotted outline shows the initial snapshot and solid fill shows current count. Color: green for target bucket, gray for others, red if target at risk.

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
# Oracle service
ORACLE_PRIVATE_KEY=           # EOA private key for posting histograms
MINITIA_RPC_URL=              # EVM JSON-RPC endpoint
HISTOGRAM_ORACLE_ADDRESS=     # Deployed HistogramOracle contract address
MARKET_FACTORY_ADDRESS=       # Deployed MarketFactory contract address
GOOGLE_PLACES_API_KEY=        # For validation cross-check

# Frontend
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=   # Google Maps JS API key
NEXT_PUBLIC_MINITIA_RPC_URL=       # EVM JSON-RPC endpoint
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=
NEXT_PUBLIC_CHAIN_ID=pinitia-1
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
npm run dev                      # Run scraper in dev mode
npm run scrape -- --place-id "ChIJ..."  # Test single place scrape
```

### Frontend

```bash
cd frontend
npm install
npm run dev                      # http://localhost:3000
```

## Key Decisions

1. **No custom indexer** — use on-chain view functions + eth_getLogs. Contracts maintain placeId→markets and user→markets mappings.
2. **Playwright over API for histogram** — the per-star breakdown is not in the Places API. Scraping is the only option. Use aria-label selectors (most stable).
3. **Trusted single oracle for hackathon** — acceptable trade-off. Roadmap: multi-sig → decentralized scraper network.
4. **Parimutuel over AMM** — simpler to implement, no liquidity bootstrapping needed, works well for binary markets.
5. **Simple auto-sign boolean** — the boolean `enableAutoSign` auto-detects EVM and grants `/minievm.evm.v1.MsgCall`. No need for explicit per-chain config unless we add multi-chain later.
6. **Delta markets as primary** — they have the most movement and narrative energy. Threshold and Ratio are secondary market types.

## Submission Checklist

- [ ] Contracts deployed on pinitia-1 Minitia
- [ ] Frontend uses InterwovenKit for wallet connection
- [ ] Auto-signing works for bet placement (3+ bets without popup)
- [ ] Oracle scrapes and resolves at least 1 market
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
