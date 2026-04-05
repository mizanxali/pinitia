# CLAUDE.md — Pinitia

Prediction markets on Google Maps venues. Bet LONG/SHORT on review velocity or rating movement. Binary parimutuel — winners split losers' pool minus 2% fee. Oracle uses Google Places API (`rating` + `userRatingCount`). Markets are operator-seeded (no user creation). Resolves on specific dates.

Initia Move appchain (minimove) for INITIATE Hackathon 2026. Deadline: April 15. Track: Gaming & Consumer.

## Market Types

- **VELOCITY** — `finalReviewCount - initialReviewCount >= target`
- **RATING** — `finalRating >= target` (scaled 1e2, e.g. 4.2 → 420)

## Architecture

```
Oracle (hourly cron) → Google Places API → PostgreSQL via Drizzle (snapshots) + Move module (post_place_data)
Frontend reads: PostgreSQL via Drizzle (history, Next.js API routes), chain via REST view queries (markets/positions), InterwovenKit (wallet + tx signing)
```

## Move Module (pinitia-1)

Single module `pinitia::prediction_market` deployed at the module address. All state lives in a `MarketRegistry` resource at the deployer's address. Markets are identified by sequential `u64` IDs (not separate contract addresses).

Source: `contracts/sources/prediction_market.move`

### Entry Functions

- `initialize(account, oracle)` — one-time setup
- `create_velocity_market(account, place_id, target, resolve_date, initial_review_count)`
- `create_rating_market(account, place_id, target, resolve_date)`
- `bet_long(account, module_addr, market_id, amount)` — withdraws native coin from sender
- `bet_short(account, module_addr, market_id, amount)`
- `post_place_data(account, module_addr, place_id, rating, review_count)` — oracle-only, auto-resolves eligible markets
- `batch_post(account, module_addr, place_ids, ratings, review_counts)`
- `claim(account, module_addr, market_id)`
- `force_resolve_market(account, module_addr, market_id, rating, review_count)`

### View Functions

- `get_market_info(market_id)` → `(market_type, place_id, target, resolve_date, long_pool, short_pool, initial_review_count, final_rating, final_review_count, resolved, long_wins)`
- `get_active_markets()` → `vector<u64>`
- `get_markets_by_place(place_id)` → `vector<u64>`
- `get_user_position(market_id, user)` → `(long_amount, short_amount, claimable)`
- `get_market_bets(market_id)` → `vector<BetEntry>` (replaces event log scanning)

### Conventions

Bets: native `umin` token (6 decimals, displayed as MIN). Ratings: scaled 1e2 (4.6 → 460). Review counts: unscaled. Resolve dates: unix timestamp. No custom indexer — use view functions via REST API.

### Building & Deploying

```sh
cd contracts
minitiad move build --language-version=2.1 --named-addresses pinitia=<deployer_hex_addr>
minitiad move deploy --named-addresses pinitia=<deployer_hex_addr> --from <key> --keyring-backend test --chain-id pinitia-1 --gas auto --gas-adjustment 1.4 --yes
```

## Frontend

Next.js 15 App Router, React 19, TypeScript, Tailwind, TanStack Query, Recharts, Drizzle ORM, `@initia/interwovenkit-react` 2.4.6, `@initia/initia.js`, `@initia/initia.proto`.

### Key Files

- `lib/contracts.ts` — `MODULE_ADDRESS` (bech32), `MODULE_NAME`, `CHAIN_ID`, `REST_URL`
- `lib/move.ts` — RESTClient singleton, BCS encoding helpers (`encodeAddressArg`, `encodeU64Arg`, `encodeStringArg`), `moveView` wrapper, `parseU64`, `formatMin`, `parseMin`
- `lib/chain.ts` — Custom chain config for InterwovenKit (minimove, umin denom, 6 decimals)

### Provider Setup (`components/Providers.tsx`)

Order: `WagmiProvider` → `QueryClientProvider` → `InterwovenKitProvider`. InterwovenKit spreads `{...TESTNET}` for bridge support. Custom chain config in `lib/chain.ts`. Styles injected via `injectStyles(InterwovenKitStyles)` in a `useEffect`.

### Pages

| Route              | Description                                                           |
| ------------------ | --------------------------------------------------------------------- |
| `/`                | Curated venue cards grid (venues loaded from `places` table via API)  |
| `/venue/[placeId]` | Venue detail — rating/review charts, active markets, snapshot history |
| `/market/[id]`     | Market detail — progress chart, pool bars, bet panel, position, claim |
| `/portfolio`       | User positions across all markets, claimable winnings                 |
| `/leaderboard`     | Top traders by PnL                                                    |

### Transaction Pattern (Move via InterwovenKit)

All write txs use `requestTxBlock` with `typeUrl: "/initia.move.v1.MsgExecute"`. The message `value` uses `MsgExecute.fromPartial()` with: `sender` (bech32 `initiaAddress`), `moduleAddress` (bech32), `moduleName: "prediction_market"`, `functionName`, `typeArgs: []`, `args: [...]` (BCS-encoded). See `useBet.ts` and `useClaim.ts`.

### Read Pattern (REST view queries)

All read calls use `moveView()` from `lib/move.ts` which calls `POST /initia/move/v1/view` on the REST API. No viem or JSON-RPC needed. See `useMarkets.ts`.

### Design System

Neobrutalism style: hard black borders (`border-2 border-border`), offset box shadows (`shadow-neo`), flat saturated colors, no gradients, no rounded corners. Fonts: Space Grotesk (headings) + Inter (body). LONG = green, SHORT = red, resolved = yellow.

## Oracle Pipeline (hourly cron)

Uses `minitiad` CLI via `child_process.execSync` for on-chain writes. Uses REST API fetch for view queries. No ethers.js or private keys — uses local keyring (`--keyring-backend test`).

1. Reads active market IDs from Move module via REST view query
2. Fetches from Google Places API, writes to PostgreSQL `place_snapshots` via Drizzle
3. If past resolveDate: posts on-chain via `minitiad tx move execute ... post_place_data` which auto-resolves eligible markets
4. Auto-creates follow-up markets: target achieved → bump (+10 velocity, +0.1 rating); not achieved → same target. Resolves in 1 hour. Skips silently if max markets per place reached.

### Oracle Config (env vars)

`MODULE_ADDRESS` (bech32), `MODULE_NAME`, `ORACLE_KEY_NAME` (keyring key), `CHAIN_ID`, `REST_URL`, `GOOGLE_PLACES_API_KEY`, `DATABASE_URL`

### Scripts

- `npx tsx src/scripts/seed-all.ts` — seed places, markets, bets, and force-resolve
- `npx tsx src/scripts/force-resolve.ts <MARKET_ID> [long|short]` — force-resolve a single market

## Database (PostgreSQL + Drizzle ORM)

Schema defined in `oracle/src/utils/schema.ts` (shared by frontend at `frontend/src/lib/schema.ts`). Local dev uses Docker via `bun run db:start`.

Table: `places` — columns: `place_id` (text, PK), `name` (text), `address` (text), `photo_url` (text), `city` (text), `category` (text), `created_at` (timestamptz). Upserted by seed script via `fetchPlaceDetails()` from Google Places API (displayName, formattedAddress, photos).

Table: `place_snapshots` — columns: `id` (serial, PK), `place_id` (text, FK → places), `rating` (numeric 3,2), `review_count` (int), `fetched_at` (timestamptz).

Frontend reads via Next.js API routes (`/api/places`, `/api/snapshots`). Oracle writes via Drizzle directly. Schema push: `bun run db:push`.

## Common Issues

- **Auto-sign not working**: `defaultChainId` must be `pinitia-1` (Cosmos ID), not EVM numeric ID. Auto-sign permission must include `/initia.move.v1.MsgExecute`.
- **Sender must be bech32**: In `MsgExecute`, use `initiaAddress` (bech32) for `sender`. `moduleAddress` must also be bech32.
- **`messages` not `msgs`**: `requestTxBlock` uses `messages` (plural). `msgs` causes `Cannot read properties of undefined`.
- **MsgExecute requires typeArgs and args**: Always include `typeArgs: []` and `args: []` even if empty, or Amino conversion fails.
- **Shadow/border mismatch**: All interactive elements must have `border-2 border-border` — don't mix rounded and flat styles.
- **Chart gaps**: Oracle downtime — connect points with lines, don't break.
- **No venue photos**: Photo URLs are fetched from Google Places API during seeding and stored in `places.photo_url`. Falls back to placeholder if null.
- **Amount decimals**: umin uses 6 decimals (not 18). `parseMin(x)` = `x * 1e6`. `formatMin(x)` = `x / 1e6`.

## Submission Checklist

- [x] Move module written and builds
- [x] PostgreSQL schema via Drizzle ORM
- [x] Frontend updated for Move (MsgExecute, REST views)
- [x] Oracle updated for Move (minitiad CLI)
- [ ] Deploy module to pinitia-1 and seed markets
- [ ] Wallet connection + auto-signing (3+ bets without popup)
- [ ] Oracle resolves at least 1 market
- [x] Progress chart with snapshot history
- [ ] `.initia/submission.json`, README with submission section
- [ ] Demo video (1-3 min): connect → auto-sign → browse → bet → resolve → claim
- [ ] Public GitHub repo
