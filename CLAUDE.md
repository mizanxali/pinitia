# CLAUDE.md — Pinitia

Prediction markets on Google Maps venues. Bet LONG/SHORT on review velocity or rating movement. Binary parimutuel — winners split losers' pool minus 2% fee. Oracle uses Google Places API (`rating` + `userRatingCount`). Markets are operator-seeded (no user creation). Resolves on specific dates.

Initia EVM appchain (Minitia) for INITIATE Hackathon 2026. Deadline: April 15. Track: Gaming & Consumer.

## Market Types

- **VELOCITY** — `finalReviewCount - initialReviewCount >= target`
- **RATING** — `finalRating >= target` (scaled 1e2, e.g. 4.2 → 420)

## Architecture

```
Oracle (hourly cron) → Google Places API → Supabase (snapshots) + PlaceOracle contract
Frontend reads: Places API (metadata), Supabase (history), chain via viem/wagmi (markets/positions)
```

## Deployed Contracts (pinitia-1)

| Contract | Address |
|---|---|
| MarketFactory | `0x5427521eDb77281468C21510A5Fa96d1c52EDb41` |
| PlaceOracle | `0xA126fBe076B879d64Cea037e862392409379C474` |

Wiring: MarketFactory.oracle → PlaceOracle contract. PlaceOracle.oracle → Gas Station EOA. Markets created by factory inherit PlaceOracle as their oracle.

## Contract ABIs (for frontend)

### MarketFactory

```
getActiveMarkets() → address[]
getMarketsByPlace(string placeId) → address[]
```

### Market

```
betLong() payable
betShort() payable
claim()
getMarketInfo() → (uint8 marketType, string placeId, uint256 target, uint256 resolveDate, uint256 longPool, uint256 shortPool, uint256 initialReviewCount, uint256 finalRating, uint256 finalReviewCount, bool resolved)
getUserPosition(address user) → (uint256 longAmount, uint256 shortAmount, uint256 claimable)
placeId() → string
resolveDate() → uint256
resolved() → bool
longWins() → bool
longPool() → uint256
shortPool() → uint256
target() → uint256
marketType() → uint8
```

Events: `BetPlaced(address indexed user, bool isLong, uint256 amount)`, `MarketResolved(bool longWins)`, `WinningsClaimed(address indexed user, uint256 amount)`

### PlaceOracle

```
postPlaceData(string placeId, uint256 rating, uint256 reviewCount)
batchPost(string[] placeIds, uint256[] ratings, uint256[] reviewCounts)
```

Event: `PlaceDataPosted(string placeId, uint256 rating, uint256 reviewCount)`

### Conventions

Bets: native GAS token (18 decimals, 1e18 wei). Ratings: 1e2 (4.6 → 460). Review counts: unscaled. Resolve dates: unix timestamp (midnight UTC). No custom indexer — use view functions + `eth_getLogs`.

## Oracle Pipeline (hourly, already running)

1. Reads active place IDs from MarketFactory on-chain
2. Fetches from Google Places API, writes to Supabase `place_snapshots`
3. If past resolveDate: posts on-chain via `PlaceOracle.postPlaceData()` which auto-resolves eligible markets

## Supabase

Table: `place_snapshots` — columns: `id`, `place_id`, `rating` (numeric 3,2), `review_count` (int), `fetched_at` (timestamptz). RLS: public read, service role write.

## Frontend (to build)

Stack: Next.js 14 App Router, TypeScript, Tailwind, Recharts, TanStack Query. Wallet: @initia/interwovenkit-react. Chain: viem + wagmi.

### Pages

- `/` — curated venue cards (no search bar)
- `/venue/[placeId]` — rating, review count, progress chart, active markets, bet CTAs
- `/market/[address]` — progress chart with target line, pools, countdown, bet panel
- `/portfolio` — positions, claimable winnings, PnL
- `/leaderboard` — top traders by PnL

### Key Hooks

- `usePlaceDetails(placeId)` — Google Places API metadata
- `useSnapshotHistory(placeId)` — Supabase time-series for charts

### InterwovenKit Setup

```tsx
const pinitiaChain = {
  id: "pinitia-1", name: "Pinitia",
  nativeCurrency: { name: "MIN", symbol: "MIN", decimals: 18 },
  rpcUrls: { default: { http: ["http://localhost:8545"] } },
};

const wagmiConfig = createConfig({
  connectors: [initiaPrivyWalletConnector],
  chains: [pinitiaChain],
  transports: { [pinitiaChain.id]: http() },
});

// Auto-signing: covers betLong, betShort, claim
<InterwovenKitProvider {...TESTNET} defaultChainId="pinitia-1" enableAutoSign>
```

### Endpoints

Local EVM JSON-RPC: `http://localhost:8545` | Rollup RPC: `localhost:26657` | REST: `localhost:1317`
L1 testnet: `rpc.testnet.initia.xyz` / `rest.testnet.initia.xyz` | Faucet: `faucet.testnet.initia.xyz`

### Frontend Env Vars

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
NEXT_PUBLIC_MINITIA_RPC_URL=http://localhost:8545
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x5427521eDb77281468C21510A5Fa96d1c52EDb41
NEXT_PUBLIC_CHAIN_ID=pinitia-1
NEXT_PUBLIC_SUPABASE_URL=https://xfsdxweuomaohfkahhai.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Dev Command

```bash
cd frontend && npm i && npm run dev   # localhost:3000
```

## Common Issues

- **Auto-sign not working**: `defaultChainId` must be `pinitia-1` (Cosmos ID), not EVM numeric ID
- **eth_getLogs empty**: Local RPC may lag — poll with retry
- **Chart gaps**: Oracle downtime — connect points with lines, don't break
- **No venue photos**: Use placeholder in VenueCard

## Submission Checklist

- [x] Contracts deployed on pinitia-1
- [x] Supabase schema + RLS
- [ ] 10–15 markets seeded across multiple venues
- [ ] Wallet connection + auto-signing (3+ bets without popup)
- [ ] Oracle resolves at least 1 market
- [ ] Progress chart with snapshot history
- [ ] `.initia/submission.json`, README with submission section
- [ ] Demo video (1-3 min): connect → auto-sign → browse → bet → resolve → claim
- [ ] Public GitHub repo
