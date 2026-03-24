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

| Contract      | Address                                      |
| ------------- | -------------------------------------------- |
| MarketFactory | `0x5427521eDb77281468C21510A5Fa96d1c52EDb41` |
| PlaceOracle   | `0xA126fBe076B879d64Cea037e862392409379C474` |

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

### UI Framework: Neobrutalism Components

Use [neobrutalism.dev](https://www.neobrutalism.dev/) — a shadcn/ui-based component library with neobrutalist styling. This gives Pinitia a bold, high-contrast, playful aesthetic that fits the prediction market vibe.

#### Setup

1. **Initialize shadcn** (CSS variables mode, not utility classes):

   ```bash
   pnpm dlx shadcn@latest init
   ```

   - When prompted, choose **CSS variables** (not utility classes — neobrutalism only supports CSS variables mode).
   - The `baseColor` choice doesn't matter — it gets overwritten.

2. **Install `tw-animate-css`** (replaces deprecated `tailwindcss-animate`):

   ```bash
   pnpm add tw-animate-css
   ```

3. **Replace `globals.css`**: Delete existing content and paste the neobrutalism styling from [neobrutalism.dev/styling](https://www.neobrutalism.dev/styling). Pick the color scheme there (blue, green, orange, violet, or custom). The styling page has a "Copy" button.

4. **Install components via CLI** — each component has a CLI command on its docs page:
   ```bash
   pnpm dlx shadcn@latest add https://neobrutalism.dev/r/button.json
   pnpm dlx shadcn@latest add https://neobrutalism.dev/r/card.json
   pnpm dlx shadcn@latest add https://neobrutalism.dev/r/badge.json
   pnpm dlx shadcn@latest add https://neobrutalism.dev/r/dialog.json
   pnpm dlx shadcn@latest add https://neobrutalism.dev/r/tabs.json
   pnpm dlx shadcn@latest add https://neobrutalism.dev/r/progress.json
   pnpm dlx shadcn@latest add https://neobrutalism.dev/r/input.json
   pnpm dlx shadcn@latest add https://neobrutalism.dev/r/table.json
   pnpm dlx shadcn@latest add https://neobrutalism.dev/r/tooltip.json
   pnpm dlx shadcn@latest add https://neobrutalism.dev/r/skeleton.json
   pnpm dlx shadcn@latest add https://neobrutalism.dev/r/alert.json
   pnpm dlx shadcn@latest add https://neobrutalism.dev/r/select.json
   ```
   Components without a CLI command: copy from the neobrutalism docs page into `components/ui/`.

#### Neobrutalism Design Principles (enforce in all UI work)

- **Hard black borders** (`border-2 border-border`) on cards, buttons, inputs, containers
- **Bold box shadows** — offset shadows (e.g. `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`) that give a "stacked paper" look
- **Flat, saturated colors** — use the CSS variables from the neobrutalism theme (`--primary`, `--secondary`, `--accent`). No gradients.
- **No rounded corners or minimal rounding** — prefer `rounded-none` or `rounded-sm`, never `rounded-xl` or `rounded-full` on containers
- **High contrast** — dark borders on light backgrounds, bold text, clear visual hierarchy
- **Chunky interactive states** — buttons translate on hover/active (`translate-x-[2px] translate-y-[2px]` + shadow removal) for a "press" effect
- **Typography** — bold headings, generous font sizes, no thin/light weights

#### Component Mapping for Pinitia

| UI Element             | Neobrutalism Component                | Notes                                                   |
| ---------------------- | ------------------------------------- | ------------------------------------------------------- |
| Venue cards on `/`     | `Card`                                | Image card variant if venue has photo, else placeholder |
| LONG/SHORT bet buttons | `Button` (default + reverse variants) | Green for LONG, red/orange for SHORT                    |
| Market info panels     | `Card` + `Badge`                      | Badge for market type (VELOCITY/RATING), status         |
| Bet amount input       | `Input`                               | With inline token symbol                                |
| Pool distribution      | `Progress`                            | Styled as LONG vs SHORT bar                             |
| Market countdown       | `Badge` or custom                     | Bold countdown with border                              |
| Position tables        | `Table`                               | Portfolio page                                          |
| Market status          | `Alert`                               | For resolved/pending/active states                      |
| Tab navigation         | `Tabs`                                | Venue page: Overview / Markets / History                |
| Dialogs/modals         | `Dialog`                              | Bet confirmation, claim winnings                        |
| Loading states         | `Skeleton`                            | Neobrutalism skeleton with hard borders                 |
| Dropdowns              | `Select`                              | Market filters                                          |
| Tooltips               | `Tooltip`                             | Explain market mechanics on hover                       |

#### Color Recommendations

Choose a bold primary from the neobrutalism styling page. Suggested:

- **Blue** — clean, fintech feel
- **Orange** — energetic, prediction-market vibe (recommended)

Supplement with semantic overrides:

- LONG positions: `bg-green-300` with `border-2 border-black`
- SHORT positions: `bg-red-300` with `border-2 border-black`
- Resolved/won: `bg-yellow-200`

#### Fonts

Neobrutalism pairs well with bold, geometric sans-serifs. Recommended:

- **Space Grotesk** (headings) + **Inter** (body) — both on Google Fonts
- Or just **Inter** everywhere at heavier weights (600-800 for headings)

Add to `layout.tsx`:

```tsx
import { Space_Grotesk, Inter } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
```

### Pages

- `/` — curated venue cards (no search bar)
- `/venue/[placeId]` — rating, review count, progress chart, active markets, bet CTAs
- `/market/[address]` — progress chart with target line, pools, countdown, bet panel
- `/portfolio` — positions, claimable winnings, PnL
- `/leaderboard` — top traders by PnL

### Key Hooks

- `usePlaceDetails(placeId)` — Google Places API metadata
- `useSnapshotHistory(placeId)` — Supabase time-series for charts

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
- **Neobrutalism components not styled**: Ensure `globals.css` uses the neobrutalism styling (not default shadcn). The CSS variables mode must be selected during shadcn init.
- **Shadow/border mismatch**: All interactive elements must have `border-2 border-border` — don't mix rounded and flat styles

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
