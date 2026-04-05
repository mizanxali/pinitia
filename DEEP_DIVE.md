# Pinitia

**Prediction markets on real-world places.** Go LONG or SHORT on Google Maps venues — bet on whether a restaurant's reviews will surge or its rating will climb. Winners split the losers' pool. Oracle-resolved using live Google Places data.

Built on an Initia Move appchain (minimove) for the **INITIATE Hackathon 2026** — Gaming & Consumer track.

---

## The Idea

Every Google Maps venue has a rating and review count that changes over time. Pinitia turns that signal into a prediction market:

- **VELOCITY markets** — Will this place gain N+ new reviews by the resolve date?
- **RATING markets** — Will this place's rating be at or above X.X by the resolve date?

Pick a side (LONG or SHORT), place your bet in MIN tokens, and wait for the oracle to resolve. If you're right, you claim your share of the losing pool minus a 2% protocol fee.

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
4. Go LONG (yes) or SHORT (no) — bet any amount of MIN
5. Oracle checks Google Places data hourly
6. On the resolve date, the oracle posts final data on-chain
7. Move module auto-resolves: LONG wins or SHORT wins
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
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────────┐
│   Google Places   │────▶│    Oracle Service    │────▶│    Move Module       │
│       API         │     │  (hourly cron, bun)  │     │ pinitia::prediction  │
└──────────────────┘     └──────┬────────────────┘     │      _market         │
                                │                      └───────┬──────────────┘
                                ▼                              │
                         ┌──────────────┐                      │
                         │  PostgreSQL   │                      │
                         │  (Drizzle)    │                      │
                         └──────┬────────┘                      │
                                │                              │
                                ▼                              ▼
                         ┌─────────────────────────────────────────────────┐
                         │              Next.js Frontend                    │
                         │  reads: PostgreSQL via API routes + REST views  │
                         │  writes: InterwovenKit (wallet + tx signing)    │
                         └─────────────────────────────────────────────────┘
```

### Components

**Move Module** — `contracts/sources/prediction_market.move`

- Single module `pinitia::prediction_market` consolidating all market logic
- `MarketRegistry` resource at the deployer's address holds all state
- Markets identified by sequential `u64` IDs (not separate contract addresses)
- Object-based vault pattern for holding native coins (FungibleAsset has no `store` ability)
- Entry functions for market creation, betting, resolution, and claiming
- View functions for querying market state, positions, and bet history

**Frontend** (Next.js 15, React 19) — `frontend/`

- Venue browsing with live market data
- Market detail pages with pool visualization, historical charts, and bet placement
- Portfolio page showing all user positions and claimable winnings
- Leaderboard ranking traders by PnL
- Wallet connection + auto-signing via InterwovenKit

**Oracle Service** (TypeScript, bun) — `oracle/`

- Hourly cron fetching Google Places API data
- Writes snapshots to PostgreSQL via Drizzle for frontend charts
- Posts on-chain data via `minitiad tx move execute` when markets are past their resolve date
- Auto-creates follow-up markets after resolution: if target was achieved, bumps target (+10 velocity, +0.1 rating); if not, keeps same target. Follow-ups resolve in 1 hour.
- Master seed script (`seed-all.ts`): seeds places to PostgreSQL, creates markets, places test bets, and force-resolves one market per venue

**PostgreSQL + Drizzle ORM** — Off-chain data layer

- `places` table: venue metadata (name, address, photo URL, city, category)
- `place_snapshots` table: historical rating/review data for charts (FK → places)
- Schema defined in `oracle/src/utils/schema.ts`, shared by frontend
- Local dev via Docker (`bun run db:start`), schema push via `bun run db:push`

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
2. InterwovenKit creates a session key scoped to `"/initia.move.v1.MsgExecute"` on `pinitia-1`
3. All subsequent bets and claims are signed automatically — no popups
4. User can disable auto-sign at any time from the same toggle

```typescript
// Enable auto-sign for Move execution calls on pinitia-1
await autoSign.enable(CHAIN_ID, {
  permissions: ["/initia.move.v1.MsgExecute"],
});

// Check status per chain
const isAutoSignEnabled = autoSign?.isEnabledByChain?.[CHAIN_ID] ?? false;
```

The toggle lives directly in the `BetPanel` component — green when active, grey when off — so users always know their signing state. This makes it possible to place 10+ bets in a session without a single wallet popup.

---

## Tech Stack

| Layer    | Technology                                                                      |
| -------- | ------------------------------------------------------------------------------- |
| Chain    | Initia Move appchain (minimove) — `pinitia-1`                                   |
| Module   | Move (Initia MoveVM), single `prediction_market` module                         |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS                                  |
| Web3     | @initia/interwovenkit-react 2.4.6, @initia/initia.js, @initia/initia.proto      |
| Charts   | Recharts                                                                        |
| Database | PostgreSQL + Drizzle ORM (local Docker for dev)                                 |
| Oracle   | bun + node-cron + minitiad CLI + Google Places API                              |
| Design   | Neobrutalism — hard borders, offset shadows, flat colors, Space Grotesk + Inter |

---

## Move Module

Chain: **pinitia-1** (Initia minimove appchain)

Module: `pinitia::prediction_market` deployed at the module address (bech32 `init1...`).

All state lives in a single `MarketRegistry` resource:

```move
struct MarketRegistry has key {
    markets: Table<u64, Market>,
    place_markets: Table<String, vector<u64>>,
    all_active_market_ids: vector<u64>,
    next_market_id: u64,
    owner: address,
    oracle: address,
    fee_balance: u64,
    vault: Object<VaultTag>,
}
```

### Entry Functions

| Function                 | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `initialize`             | One-time setup, sets owner and oracle address           |
| `create_velocity_market` | Create a review count velocity market                   |
| `create_rating_market`   | Create a rating threshold market                        |
| `bet_long`               | Place a LONG bet (withdraws umin from sender)           |
| `bet_short`              | Place a SHORT bet (withdraws umin from sender)          |
| `post_place_data`        | Oracle posts data, auto-resolves eligible markets       |
| `batch_post`             | Batch version of post_place_data for multiple places    |
| `claim`                  | Winners withdraw payout after resolution                |
| `force_resolve_market`   | Owner-only override to resolve a market with given data |

### View Functions

| Function               | Returns                                           |
| ---------------------- | ------------------------------------------------- |
| `get_active_markets`   | `vector<u64>` — all active market IDs             |
| `get_markets_by_place` | `vector<u64>` — markets for a specific venue      |
| `get_market_info`      | Full market state (type, pools, target, resolved) |
| `get_user_position`    | User's long/short amounts and claimable winnings  |
| `get_market_bets`      | `vector<BetEntry>` — all bets on a market         |
| `get_market_count`     | Total number of markets created                   |

### Native Coin Handling

Bets are placed in `umin` (6 decimals, displayed as MIN). The module uses an Object-based vault pattern since `FungibleAsset` has no `store` ability in Initia Move. Coins are deposited to the vault via `primary_fungible_store::deposit`, and pool amounts are tracked as plain `u64` values.

### Building & Deploying

```bash
cd contracts
minitiad move build --language-version=2.1 --named-addresses pinitia=<deployer_hex_addr>
minitiad move deploy --named-addresses pinitia=<deployer_hex_addr> \
  --from <key> --keyring-backend test \
  --chain-id pinitia-1 --gas auto --gas-adjustment 1.4 --yes
```

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
- [Docker](https://docs.docker.com/get-docker/) (for local PostgreSQL)
- [Go](https://go.dev/) (for building minitiad)
- `minitiad` (minimove binary — `git clone https://github.com/initia-labs/minimove.git && make install`)
- `weave` + `initiad` (for rollup management — `scripts/install-tools.sh`)
- Google Places API key

### Install

```bash
bun run install:all
```

### Environment Variables

**Oracle** (`oracle/.env`) — copy from `oracle/.env.example`:

```
MODULE_ADDRESS=            # Bech32 deployer address (init1...)
MODULE_NAME=prediction_market
ORACLE_KEY_NAME=           # Keyring key name (e.g., gas-station)
CHAIN_ID=pinitia-1
REST_URL=http://localhost:1317
GOOGLE_PLACES_API_KEY=     # Google Places API key
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pinitia
```

**Frontend** (`frontend/.env.local`):

```
NEXT_PUBLIC_MODULE_ADDRESS=    # Bech32 deployer address (init1...)
NEXT_PUBLIC_CHAIN_ID=pinitia-1
NEXT_PUBLIC_REST_URL=http://localhost:1317
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pinitia
```

### Run

```bash
# Start local PostgreSQL (Docker)
bun run oracle:db-start

# Push Drizzle schema to database
bun run oracle:db-push

# Frontend (dev server)
bun run frontend:dev

# Oracle (hourly cron)
bun run oracle:dev

# Seed everything (places + markets + bets + resolve)
bun run oracle:seed-all

# Browse database (Drizzle Studio)
bun run oracle:db-studio

# Build Move module
cd contracts && minitiad move build --language-version=2.1 --named-addresses pinitia=<hex_addr>
```

### Seeding & Testing

```bash
# Master seed: places → markets → bets → force-resolve one per venue
bun run oracle:seed-all
bun run oracle:seed-all -- --bets 5 --max-amount 2

# Force-resolve a market (for testing)
bun run oracle:force-resolve <market-id> long|short
```

---

## Key Design Decisions

**Binary parimutuel over AMM**: Simpler mental model — you see the pool sizes, you know your odds. No impermanent loss, no liquidity provision required.

**Operator-seeded markets**: Markets are created by the protocol, not users. This prevents spam and ensures markets are attached to real, interesting venues.

**Google Places as oracle source**: Publicly verifiable, no insider advantage, updates organically. The hourly cron provides sufficient resolution for markets that resolve over days/weeks.

**Initia Move (minimove)**: Native Cosmos wallet UX via InterwovenKit with Move module execution. Single module consolidates all logic — no separate contract deployments per market. Auto-signing means users can place multiple bets without repeated popups.

**Object vault pattern**: FungibleAsset in Initia Move has no `store` ability, so coins can't be stored directly in resources. The module creates an Object with an ExtendRef and uses `primary_fungible_store` for deposits/withdrawals, tracking pool amounts as plain `u64`.

**Off-chain snapshots**: Historical rating/review data stored in PostgreSQL (via Drizzle ORM) for fast frontend chart rendering. On-chain data is limited to resolution-critical values.

**CLI-based oracle**: The oracle uses `minitiad tx move execute` via `child_process.execSync` instead of a TypeScript SDK. This leverages the local keyring (`--keyring-backend test`) — no private keys in environment variables.

---

## Transaction Pattern

All write transactions go through InterwovenKit's `requestTxBlock` using Initia's Move execution message type:

```typescript
import { MsgExecute } from "@initia/initia.proto/initia/move/v1/tx";

await requestTxBlock({
  chainId: "pinitia-1",
  messages: [
    {
      typeUrl: "/initia.move.v1.MsgExecute",
      value: MsgExecute.fromPartial({
        sender: initiaAddress, // bech32
        moduleAddress: MODULE_ADDRESS, // bech32
        moduleName: "prediction_market",
        functionName: "bet_long",
        typeArgs: [],
        args: [
          bcsEncodeAddress(MODULE_ADDRESS),
          bcsEncodeU64(marketId),
          bcsEncodeU64(amount),
        ],
      }),
    },
  ],
});
```

Read calls use REST view queries via `POST /initia/move/v1/view` — no viem or JSON-RPC required.

---

## Submission Checklist

- [x] Move module written and builds
- [x] PostgreSQL schema via Drizzle ORM
- [x] Frontend with venue browsing, market detail, portfolio, leaderboard
- [x] InterwovenKit wallet connection + auto-signing
- [x] Oracle pipeline (hourly Google Places → PostgreSQL + on-chain via minitiad CLI)
- [x] Historical snapshot charts (Recharts)
- [ ] Deploy module to pinitia-1 and seed markets
- [ ] Oracle resolves at least 1 market end-to-end
- [ ] `.initia/submission.json`
- [ ] Demo video (1-3 min)
- [ ] Public GitHub repo

---

## Project Structure

```
pinitia/
├── contracts/         # Move module
│   ├── Move.toml
│   └── sources/
│       └── prediction_market.move
├── frontend/               # Next.js 15 app
│   └── src/
│       ├── app/            # Pages (home, venue, market, portfolio, leaderboard)
│       ├── components/     # UI components
│       ├── hooks/          # Data fetching (useMarkets, useBet, useClaim, etc.)
│       └── lib/            # Config, Move helpers, Drizzle DB client, schema, utils
│           ├── contracts.ts   # MODULE_ADDRESS, CHAIN_ID, REST_URL
│           ├── move.ts        # RESTClient, BCS encoding, moveView wrapper
│           ├── chain.ts       # Custom chain config (minimove, umin)
│           └── schema.ts      # Drizzle table schema (shared with oracle)
├── oracle/                 # Oracle service
│   └── src/
│       ├── index.ts        # Hourly cron entry point
│       ├── utils/
│       │   ├── config.ts   # Environment config (MODULE_ADDRESS, ORACLE_KEY_NAME, etc.)
│       │   ├── fetcher.ts  # Google Places API client
│       │   ├── poster.ts   # On-chain posting via minitiad CLI + REST view queries
│       │   ├── db.ts       # PostgreSQL reads/writes via Drizzle
│       │   └── schema.ts   # Drizzle table schema
│       ├── scripts/
│       │   ├── seed-all.ts      # Master seed: places → markets → bets → force-resolve
│       │   └── force-resolve.ts # Force-resolve a market for testing
│       └── data/
│           └── venues.json # Curated venue list
├── CLAUDE.md
├── DEEP_DIVE.md
└── README.md
```

---

Built for [INITIATE Hackathon 2026](https://initia.xyz) — Gaming & Consumer track.
