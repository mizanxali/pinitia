# Pinitia

**Prediction markets on real-world places.** Go LONG or SHORT on Google Maps venues — bet on whether a restaurant's reviews will surge or its rating will climb. Winners split the losers' pool. Oracle-resolved using live Google Places data.

Built on an Initia EVM appchain (Minitia) for the **INITIATE Hackathon 2026** — Gaming & Consumer track.

---

## The Idea

Every Google Maps venue has a rating and review count that changes over time. Pinitia turns that signal into a prediction market:

- **VELOCITY markets** — Will this place gain N+ new reviews by the resolve date?
- **RATING markets** — Will this place's rating be at or above X.X by the resolve date?

Pick a side (LONG or SHORT), place your bet in GAS tokens, and wait for the oracle to resolve. If you're right, you claim your share of the losing pool minus a 2% protocol fee.

### Why?

- Restaurants, cafes, and venues already have real-time public data via Google Maps
- Review velocity and rating movement are genuinely unpredictable — there's no insider edge
- Binary parimutuel payouts are simple to reason about: you know the pool sizes before you bet
- It's fun to have skin in the game on places you actually visit

---

## How It Works

```
1. Browse curated venues on the home page
2. Pick a market (e.g. "Will Toit gain 50+ reviews by April 10?")
3. Connect your Initia wallet via InterwovenKit
4. Go LONG (yes) or SHORT (no) — bet any amount of GAS
5. Oracle checks Google Places data hourly
6. On the resolve date, the oracle posts final data on-chain
7. Smart contract auto-resolves: LONG wins or SHORT wins
8. Winners claim payouts — your bet + proportional share of the losing pool - 2% fee
```

### Market Types

| Type         | Question                              | Resolution                                                             |
| ------------ | ------------------------------------- | ---------------------------------------------------------------------- |
| **VELOCITY** | Will this place gain ≥ N new reviews? | `finalReviewCount - initialReviewCount >= target`                      |
| **RATING**   | Will this place's rating be ≥ X.X?    | `finalRating >= target` (ratings scaled ×100 on-chain, e.g. 4.2 → 420) |

### Payout Formula

Binary parimutuel — all bets on the winning side share the losing pool proportionally:

```
payout = userBet + (userBet / winningPool) × losingPool × 0.98
```

The 2% fee is taken from the losing pool only and sent to the protocol.

---

## Architecture

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│   Google Places   │────▶│    Oracle Service    │────▶│   PlaceOracle    │
│       API         │     │  (hourly cron, bun)  │     │   (Solidity)     │
└──────────────────┘     └──────┬────────────────┘     └───────┬──────────┘
                                │                              │
                                ▼                              ▼
                         ┌──────────────┐              ┌──────────────────┐
                         │   Supabase    │              │  MarketFactory   │
                         │  (snapshots)  │              │   (Solidity)     │
                         └──────┬────────┘              └───────┬──────────┘
                                │                              │
                                ▼                              ▼
                         ┌─────────────────────────────────────────────────┐
                         │              Next.js Frontend                    │
                         │  reads: Supabase (history) + chain via viem     │
                         │  writes: InterwovenKit (wallet + tx signing)    │
                         └─────────────────────────────────────────────────┘
```

### Components

**Smart Contracts** (Solidity, Foundry) — `contracts/`

- `MarketFactory.sol` — Creates VELOCITY and RATING markets, tracks active markets per venue
- `Market.sol` — Individual market logic: betting, resolution, payouts, 2% fee
- `PlaceOracle.sol` — Receives Google Places data, auto-resolves eligible markets past their resolve date

**Frontend** (Next.js 15, React 19) — `frontend/`

- Venue browsing with live market data
- Market detail pages with pool visualization, historical charts, and bet placement
- Portfolio page showing all user positions and claimable winnings
- Leaderboard ranking traders by PnL
- Wallet connection + auto-signing via InterwovenKit

**Oracle Service** (TypeScript, bun) — `oracle/`

- Hourly cron fetching Google Places API data
- Writes snapshots to Supabase for frontend charts
- Posts on-chain data via PlaceOracle when markets are past their resolve date
- Seeding scripts for creating initial markets and test bets

**Supabase** — Off-chain data layer

- `places` table: venue metadata (name, address, photo URL)
- `place_snapshots` table: historical rating/review data for charts

---

## Initia-Native Features

### Usernames

Pinitia integrates **Initia Usernames** — the native on-chain identity system — throughout the app. Instead of showing raw `init1...` addresses, we resolve human-readable usernames via InterwovenKit's `useUsernameQuery` hook:

- **Navbar**: Connected wallet shows the user's Initia username (falls back to shortened address)
- **Bet history**: Every bet in a market's "All Bets" table displays the bettor's username
- **Leaderboard**: Top traders are shown by username, making the rankings feel social rather than anonymous

```typescript
// Navbar — show username or fallback
const { initiaAddress, username } = useInterwovenKit();
// renders: username ? username : shortenAddress(initiaAddress)

// Bet rows & leaderboard — resolve any address to a username
const { data: username } = useUsernameQuery(bet.user);
```

This turns an otherwise anonymous on-chain experience into a social one — you can see who's betting on what.

### Auto-Signing

Prediction markets require rapid, repeated transactions (browse → bet → browse → bet). Signing every single one via wallet popup kills the UX. Pinitia uses **Initia Auto-Sign** to eliminate friction after a one-time opt-in:

1. User clicks the **Auto-Sign** toggle in the bet panel
2. InterwovenKit creates a session key scoped to `"/minievm.evm.v1.MsgCall"` on `pinitia-1`
3. All subsequent bets and claims are signed automatically — no popups
4. User can disable auto-sign at any time from the same toggle

```typescript
// Enable auto-sign for EVM calls on pinitia-1
await autoSign.enable(CHAIN_ID, {
  permissions: ["/minievm.evm.v1.MsgCall"],
});

// Check status per chain
const isAutoSignEnabled = autoSign?.isEnabledByChain?.[CHAIN_ID] ?? false;
```

The toggle lives directly in the `BetPanel` component — green when active, grey when off — so users always know their signing state. This makes it possible to place 10+ bets in a session without a single wallet popup.

---

## Tech Stack

| Layer     | Technology                                                                      |
| --------- | ------------------------------------------------------------------------------- |
| Chain     | Initia EVM appchain (Minitia) — `pinitia-1`                                     |
| Contracts | Solidity 0.8.20, Foundry                                                        |
| Frontend  | Next.js 15, React 19, TypeScript, Tailwind CSS                                  |
| Web3      | wagmi 2.17.2, viem 2.47.6, @initia/interwovenkit-react 2.4.6                    |
| Charts    | Recharts                                                                        |
| Database  | Supabase (PostgreSQL + RLS)                                                     |
| Oracle    | bun + node-cron + ethers.js 6 + Google Places API                               |
| Design    | Neobrutalism — hard borders, offset shadows, flat colors, Space Grotesk + Inter |

---

## Deployed Contracts

Chain: **pinitia-1** (Initia EVM Minitia)

| Contract      | Address                                      |
| ------------- | -------------------------------------------- |
| MarketFactory | `0xBf1907170CB123DEEC0fD4D2854F8F24a18C40A4` |
| PlaceOracle   | `0x02b5a81a88A7596852EC72dd398166387d2f1b86` |

**Wiring**: MarketFactory's oracle → PlaceOracle contract. PlaceOracle's oracle → Gas Station EOA. Markets created by the factory inherit PlaceOracle as their oracle.

---

## Venues

14 curated Bangalore venues across 5 categories:

- **Restaurants**: Skyye, Truffles Indiranagar
- **Cafes**: Dyu Art Cafe, The Hole In The Wall Cafe, Lazy Suzy
- **Breweries**: Toit, Ironhill, BLR Brewing Co, Long Boat
- **Gaming**: The Grid, Loco Bear
- **Museums & Galleries**: MAP, Karnataka Chitrakala Parishath, National Gallery of Modern Art

---

## Running Locally

### Prerequisites

- [bun](https://bun.sh/) (runtime + package manager)
- [Foundry](https://book.getfoundry.sh/) (for contracts)
- Google Places API key
- Supabase project with `places` and `place_snapshots` tables

### Install

```bash
bun run install:all
```

### Environment Variables

**Oracle** (`oracle/.env`) — copy from `oracle/.env.example`:

```
ORACLE_PRIVATE_KEY=        # EOA private key for posting oracle data
MINITIA_RPC_URL=           # Minitia JSON-RPC endpoint
PLACE_ORACLE_ADDRESS=      # PlaceOracle contract address
MARKET_FACTORY_ADDRESS=    # MarketFactory contract address
GOOGLE_PLACES_API_KEY=     # Google Places API key
SUPABASE_URL=              # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY= # Supabase service role key (write access)
```

**Frontend** (`frontend/.env.local`):

```
NEXT_PUBLIC_MINITIA_RPC_URL=           # Minitia JSON-RPC endpoint
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=    # MarketFactory contract address
NEXT_PUBLIC_CHAIN_ID=pinitia-1
NEXT_PUBLIC_SUPABASE_URL=              # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=         # Supabase anon key (read-only)
```

### Run

```bash
# Frontend (dev server)
bun run frontend:dev

# Oracle (hourly cron)
bun run oracle:dev

# Seed markets (one-time)
bun run oracle:seed

# Compile contracts
cd contracts && forge build

# Run contract tests
cd contracts && forge test
```

### Seeding & Testing

```bash
# Create initial markets across all venues
bun run oracle:seed

# Populate markets with test bets
cd oracle && bunx tsx src/seed-bets.ts --bets 5 --max-amount 2

# Force-resolve a market (for testing)
cd oracle && bunx tsx src/force-resolve.ts <market-address> long|short
```

---

## Key Design Decisions

**Binary parimutuel over AMM**: Simpler mental model — you see the pool sizes, you know your odds. No impermanent loss, no liquidity provision required.

**Operator-seeded markets**: Markets are created by the protocol, not users. This prevents spam and ensures markets are attached to real, interesting venues.

**Google Places as oracle source**: Publicly verifiable, no insider advantage, updates organically. The hourly cron provides sufficient resolution for markets that resolve over days/weeks.

**Initia EVM (Minitia)**: Native Cosmos wallet UX via InterwovenKit with EVM contract execution. Auto-signing means users can place multiple bets without repeated popups.

**Off-chain snapshots**: Historical rating/review data stored in Supabase for fast frontend chart rendering. On-chain data is limited to resolution-critical values.

---

## Smart Contract Details

### MarketFactory

- `createVelocityMarket(placeId, target, resolveDate, initialReviewCount)` → deploys a new Market
- `createRatingMarket(placeId, target, resolveDate)` → deploys a new Market
- `getActiveMarkets()` → all market addresses
- `getMarketsByPlace(placeId)` → markets for a specific venue
- Max 5 markets per place

### Market

- `betLong() payable` / `betShort() payable` — place bets (must be before resolve date)
- `claim()` — winners withdraw payout after resolution
- `getMarketInfo()` → full market state
- `getUserPosition(address)` → user's bets and claimable amount
- Resolution is oracle-only; called automatically by PlaceOracle

### PlaceOracle

- `postPlaceData(placeId, rating, reviewCount)` — oracle EOA posts fresh data
- `batchPost(placeIds[], ratings[], reviewCounts[])` — batch version
- Auto-resolves all markets for a place that are past their resolve date
- `forceResolveMarket(marketAddr, rating, reviewCount)` — owner-only override

---

## Transaction Pattern

All write transactions go through InterwovenKit's `requestTxBlock` using Initia's EVM message type:

```typescript
await requestTxBlock({
  chainId: "pinitia-1",
  messages: [
    {
      typeUrl: "/minievm.evm.v1.MsgCall",
      value: {
        sender: initiaAddress.toLowerCase(), // bech32
        contractAddr: marketAddress, // hex
        input: encodeFunctionData({ abi, functionName, args }),
        value: parseEther(amount).toString(),
        accessList: [],
        authList: [],
      },
    },
  ],
});
```

Read calls use a standalone viem `publicClient` — no wallet extension required.

---

## Submission Checklist

- [x] Smart contracts deployed on `pinitia-1`
- [x] Supabase schema with RLS policies
- [x] Frontend with venue browsing, market detail, portfolio, leaderboard
- [x] InterwovenKit wallet connection + auto-signing
- [x] Oracle pipeline (hourly Google Places → Supabase + on-chain)
- [x] Historical snapshot charts (Recharts)
- [x] 10–15 markets seeded across multiple venues
- [ ] Oracle resolves at least 1 market end-to-end
- [ ] `.initia/submission.json`
- [ ] Demo video (1–3 min)
- [ ] Public GitHub repo

---

## Project Structure

```
pinitia/
├── contracts/           # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── MarketFactory.sol
│   │   ├── Market.sol
│   │   └── PlaceOracle.sol
│   ├── script/Deploy.s.sol
│   └── test/
├── frontend/            # Next.js 15 app
│   └── src/
│       ├── app/         # Pages (home, venue, market, portfolio, leaderboard)
│       ├── components/  # UI components
│       ├── hooks/       # Data fetching (useMarkets, useBet, useClaim, etc.)
│       └── lib/         # Config, ABIs, Supabase client, utilities
├── oracle/              # Oracle service
│   └── src/
│       ├── index.ts     # Hourly cron
│       ├── fetcher.ts   # Google Places API
│       ├── poster.ts    # On-chain posting
│       ├── db.ts        # Supabase writes
│       ├── seed.ts      # Market creation
│       └── venues.json  # Curated venue list
└── CLAUDE.md
```

---

Built for [INITIATE Hackathon 2026](https://initia.xyz) — Gaming & Consumer track.
