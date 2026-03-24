## Initia Hackathon Submission

- **Project Name**: Pinitia

### Project Overview

Pinitia is a prediction market platform where users bet on the real-world performance of Google Maps venues — will a restaurant gain 50 new reviews by next week, or will a cafe's rating hit 4.5? Users go LONG or SHORT using GAS tokens on an Initia EVM appchain, and an automated oracle resolves markets using live Google Places API data. It's built for anyone who wants skin in the game on places they actually visit, combining the thrill of prediction markets with publicly verifiable, real-world data that has no insider edge.

### Implementation Detail

- **The Custom Implementation**: A full binary parimutuel prediction market system tied to Google Maps data. Three Solidity contracts (MarketFactory, Market, PlaceOracle) handle market creation, betting, and oracle-driven resolution. An off-chain oracle service runs on an hourly cron, fetching live rating and review count data from the Google Places API, writing snapshots to Supabase for historical charts, and posting resolution data on-chain — which auto-resolves any eligible markets past their resolve date. The frontend provides venue browsing, real-time pool visualization, historical snapshot charts, a portfolio tracker, and a PnL leaderboard. Two market types exist: VELOCITY (will review count grow by N?) and RATING (will rating reach X.X?), both resolved purely from public Google data. For a comprehensive technical deep dive into the architecture, smart contracts, oracle pipeline, transaction patterns, and design decisions, see [DEEP_DIVE.md](./DEEP_DIVE.md).

- **The Native Feature**: Pinitia uses two Interwoven features — **Initia Usernames** and **Auto-Signing**:
  - **Usernames**: Instead of showing raw `init1...` addresses, the app resolves human-readable Initia usernames via InterwovenKit's `useUsernameQuery` hook across the navbar, bet history tables, and leaderboard. This makes the experience social — you see who's betting on what, not anonymous hex strings.
  - **Auto-Signing**: Prediction markets require rapid, repeated transactions. Pinitia integrates InterwovenKit's auto-sign feature with a toggle in the bet panel that creates a session key scoped to `"/minievm.evm.v1.MsgCall"` on `pinitia-1`. Once enabled, users can place 10+ bets in a session without a single wallet popup, making the UX feel like a web2 app.

### How to Run Locally

1. **Install dependencies**: Make sure [bun](https://bun.sh/) is installed, then run:

   ```bash
   bun run install:all
   ```

2. **Configure environment**: Copy `oracle/.env.example` to `oracle/.env` and fill in your Oracle private key, Minitia RPC URL, contract addresses, Google Places API key, and Supabase credentials. For the frontend, create `frontend/.env.local` with:

   ```
   NEXT_PUBLIC_MINITIA_RPC_URL=<your-rpc>
   NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0xBf1907170CB123DEEC0fD4D2854F8F24a18C40A4
   NEXT_PUBLIC_CHAIN_ID=pinitia-1
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```

3. **Seed markets** (if starting fresh):

   ```bash
   bun run oracle:seed
   ```

4. **Start the app**:
   ```bash
   bun run frontend:dev    # Next.js frontend on localhost:3000
   bun run oracle:dev      # Oracle cron (hourly Google Places fetch + on-chain posting)
   ```
