# CLAUDE.md — Pinitia

Prediction markets on Google Maps venues. Bet LONG/SHORT on review velocity or rating movement. Binary parimutuel — winners split losers' pool minus 2% fee. Oracle uses Google Places API (`rating` + `userRatingCount`). Markets are operator-seeded (no user creation). Resolves on specific dates.

Initia EVM appchain (Minitia) for INITIATE Hackathon 2026. Deadline: April 15. Track: Gaming & Consumer.

## Market Types

- **VELOCITY** — `finalReviewCount - initialReviewCount >= target`
- **RATING** — `finalRating >= target` (scaled 1e2, e.g. 4.2 → 420)

## Architecture

```
Oracle (hourly cron) → Google Places API → Supabase (snapshots) + PlaceOracle contract
Frontend reads: Supabase (history), chain via viem (markets/positions), InterwovenKit (wallet + tx signing)
```

## Deployed Contracts (pinitia-1)

| Contract      | Address                                      |
| ------------- | -------------------------------------------- |
| MarketFactory | `0xBf1907170CB123DEEC0fD4D2854F8F24a18C40A4` |
| PlaceOracle   | `0x02b5a81a88A7596852EC72dd398166387d2f1b86` |

Wiring: MarketFactory.oracle → PlaceOracle contract. PlaceOracle.oracle → Gas Station EOA. Markets created by factory inherit PlaceOracle as their oracle.

## Contract ABIs

Full ABIs in `frontend/src/lib/abi.ts`. Key functions:

**MarketFactory**: `getActiveMarkets() → address[]`, `getMarketsByPlace(placeId) → address[]`

**Market**: `betLong() payable`, `betShort() payable`, `claim()`, `getMarketInfo() → (marketType, placeId, target, resolveDate, longPool, shortPool, initialReviewCount, finalRating, finalReviewCount, resolved)`, `getUserPosition(address) → (longAmount, shortAmount, claimable)`

**PlaceOracle**: `postPlaceData(placeId, rating, reviewCount)`, `batchPost(...)`

Events: `BetPlaced(user, isLong, amount)`, `MarketResolved(longWins)`, `WinningsClaimed(user, amount)`, `PlaceDataPosted(placeId, rating, reviewCount)`

### Conventions

Bets: native GAS token (18 decimals). Ratings: scaled 1e2 (4.6 → 460). Review counts: unscaled. Resolve dates: unix timestamp. No custom indexer — use view functions + `eth_getLogs`.

## Frontend

Next.js 15 App Router, React 19, TypeScript, Tailwind, wagmi 2.17.2, viem, TanStack Query, Recharts, Supabase client, `@initia/interwovenkit-react` 2.4.6.

### Provider Setup (`components/Providers.tsx`)

Order: `WagmiProvider` → `QueryClientProvider` → `InterwovenKitProvider`. InterwovenKit spreads `{...TESTNET}` for bridge support. Custom chain config in `lib/chain.ts`. Styles injected via `injectStyles(InterwovenKitStyles)` in a `useEffect`.

### Pages

| Route               | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| `/`                 | Curated venue cards grid (venues loaded from Supabase `places` table)      |
| `/venue/[placeId]`  | Venue detail — rating/review charts, active markets, snapshot history      |
| `/market/[address]` | Market detail — progress chart, pool bars, bet panel, user position, claim |
| `/portfolio`        | User positions across all markets, claimable winnings                      |
| `/leaderboard`      | Top traders by PnL                                                         |

### Hooks

| Hook                 | Source        | Purpose                                                        |
| -------------------- | ------------- | -------------------------------------------------------------- |
| `useActiveMarkets`   | viem JSON-RPC | All active market addresses + info from chain                  |
| `useMarketInfo`      | viem JSON-RPC | Single market detail via `getMarketInfo()`                     |
| `usePlaceMarkets`    | viem JSON-RPC | Markets filtered by placeId                                    |
| `useUserPosition`    | viem JSON-RPC | User's long/short/claimable for a market                       |
| `useBet`             | InterwovenKit | `placeBet(isLong, amount)` via `requestTxBlock` with `MsgCall` |
| `useClaim`           | InterwovenKit | `claim()` via `requestTxBlock` with `MsgCall`                  |
| `useSnapshotHistory` | Supabase      | Time-series snapshots for charts                               |
| `usePlaces`          | Supabase      | All places (name, address, photo) for homepage                 |
| `usePlace`           | Supabase      | Single place metadata by placeId                               |

### Transaction Pattern (EVM via InterwovenKit)

All write txs use `requestTxBlock` with `typeUrl: "/minievm.evm.v1.MsgCall"`. The message `value` object must include: `sender` (bech32, lowercased `initiaAddress`), `contractAddr` (hex), `input` (ABI-encoded via `encodeFunctionData`), `value` (stringified wei), `accessList: []`, `authList: []`. See `useBet.ts` and `useClaim.ts` for examples.

### Read Pattern (EVM via viem)

All read calls use a standalone `publicClient` created with `createPublicClient({ transport: http(MINITIA_RPC_URL) })` — not wallet-injected. This avoids requiring an EVM browser extension. See `useMarkets.ts`.

### Key Libs

- `lib/chain.ts` — `pinitiaChain` custom chain config for InterwovenKit
- `lib/contracts.ts` — env-backed constants: `MARKET_FACTORY_ADDRESS`, `CHAIN_ID`, `MINITIA_RPC_URL`, Supabase URL/key
- `lib/abi.ts` — `MarketFactoryABI`, `MarketABI` (viem-compatible const arrays)
- `lib/supabase.ts` — Supabase client + `PlaceSnapshot` type
- `lib/utils.ts` — `cn`, `shortenAddress`, `formatGas` (wei→human), `formatRating` (scaled→decimal), `getCountdown`, `getMarketStatus`

### Components

- `Providers.tsx` — WagmiProvider + QueryClientProvider + InterwovenKitProvider wrapper
- `Navbar.tsx` — connect/wallet button via `useInterwovenKit` (`openConnect`/`openWallet`)
- `BetPanel.tsx` — LONG/SHORT bet form with pool visualization
- `MarketCard.tsx` — market summary card for listing pages
- `VenueCard.tsx` — venue card for homepage
- `SnapshotChart.tsx` — Recharts line chart for rating/review history

### Design System

Neobrutalism style: hard black borders (`border-2 border-border`), offset box shadows (`shadow-neo`), flat saturated colors, no gradients, no rounded corners. Fonts: Space Grotesk (headings) + Inter (body). LONG = green, SHORT = red, resolved = yellow.

### Env Vars

```
NEXT_PUBLIC_MINITIA_RPC_URL=http://localhost:8545
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0xBf1907170CB123DEEC0fD4D2854F8F24a18C40A4
NEXT_PUBLIC_CHAIN_ID=pinitia-1
NEXT_PUBLIC_SUPABASE_URL=https://xfsdxweuomaohfkahhai.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
```

### Dev Command

```bash
cd frontend && npm i && npm run dev   # localhost:3000
```

## Oracle Pipeline (hourly, already running)

1. Reads active place IDs from MarketFactory on-chain
2. Fetches from Google Places API, writes to Supabase `place_snapshots`
3. If past resolveDate: posts on-chain via `PlaceOracle.postPlaceData()` which auto-resolves eligible markets

## Supabase

Table: `places` — columns: `place_id` (text, PK), `name` (text), `address` (text), `photo_url` (text), `created_at` (timestamptz). RLS: public read. Upserted by seed script via `fetchPlaceDetails()` from Google Places API (displayName, formattedAddress, photos).

Table: `place_snapshots` — columns: `id`, `place_id`, `rating` (numeric 3,2), `review_count` (int), `fetched_at` (timestamptz). RLS: public read, service role write.

## Common Issues

- **Auto-sign not working**: `defaultChainId` must be `pinitia-1` (Cosmos ID), not EVM numeric ID.
- **Sender must be bech32**: In `MsgCall`, use `initiaAddress` (bech32, lowercased) for `sender`, hex for `contractAddr`.
- **`messages` not `msgs`**: `requestTxBlock` uses `messages` (plural). `msgs` causes `Cannot read properties of undefined`.
- **eth_getLogs empty**: Local RPC may lag — poll with retry.
- **Shadow/border mismatch**: All interactive elements must have `border-2 border-border` — don't mix rounded and flat styles.
- **Chart gaps**: Oracle downtime — connect points with lines, don't break
- **No venue photos**: Photo URLs are fetched from Google Places API during seeding and stored in `places.photo_url`. Falls back to 📍 placeholder if null.

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
