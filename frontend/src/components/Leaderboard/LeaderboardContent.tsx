"use client";

import { useActiveMarkets } from "@/hooks/useMarkets";
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, parseAbiItem } from "viem";
import { MINITIA_RPC_URL } from "@/lib/contracts";
import { formatGas, shortenAddress } from "@/lib/utils";
import { useUsernameQuery } from "@initia/interwovenkit-react";

const client = createPublicClient({
  transport: http(MINITIA_RPC_URL),
});

interface LeaderboardEntry {
  address: string;
  totalBet: bigint;
  totalClaimed: bigint;
  pnl: bigint;
  bets: number;
}

function LeaderboardRow({
  entry,
  rank,
}: {
  entry: LeaderboardEntry;
  rank: number;
}) {
  const { data: username } = useUsernameQuery(entry.address);

  return (
    <tr
      className={`${rank % 2 === 0 ? "bg-background" : "bg-muted/30"} ${
        rank < 3 ? "font-bold" : ""
      }`}
    >
      <td className="px-4 py-3 font-heading text-sm font-extrabold">
        {rank + 1}
      </td>
      <td className="px-4 py-3 font-body text-sm font-bold">
        {username ? username : shortenAddress(entry.address)}
      </td>
      <td className="px-4 py-3 text-right font-body text-sm">{entry.bets}</td>
      <td className="px-4 py-3 text-right font-body text-sm">
        {formatGas(entry.totalBet)}
      </td>
      <td className="px-4 py-3 text-right font-body text-sm">
        {formatGas(entry.totalClaimed)}
      </td>
      <td
        className={`px-4 py-3 text-right font-body text-sm font-extrabold ${
          entry.pnl > 0n
            ? "text-green-700"
            : entry.pnl < 0n
              ? "text-red-600"
              : ""
        }`}
      >
        {entry.pnl > 0n ? "+" : ""}
        {formatGas(entry.pnl)} GAS
      </td>
    </tr>
  );
}

export default function LeaderboardContent() {
  const { data: markets } = useActiveMarkets();

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["leaderboard", markets?.map((m) => m.address)],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      if (!markets || markets.length === 0) return [];

      const userMap = new Map<
        string,
        { totalBet: bigint; totalClaimed: bigint; bets: number }
      >();

      await Promise.all(
        markets.map(async (market) => {
          try {
            const betLogs = await client.getLogs({
              address: market.address,
              event: parseAbiItem(
                "event BetPlaced(address indexed user, bool isLong, uint256 amount)",
              ),
              fromBlock: 0n,
              toBlock: "latest",
            });

            for (const log of betLogs) {
              const user = log.args.user!.toLowerCase();
              const amount = log.args.amount!;
              const existing = userMap.get(user) ?? {
                totalBet: 0n,
                totalClaimed: 0n,
                bets: 0,
              };
              existing.totalBet += amount;
              existing.bets += 1;
              userMap.set(user, existing);
            }

            const claimLogs = await client.getLogs({
              address: market.address,
              event: parseAbiItem(
                "event WinningsClaimed(address indexed user, uint256 amount)",
              ),
              fromBlock: 0n,
              toBlock: "latest",
            });

            for (const log of claimLogs) {
              const user = log.args.user!.toLowerCase();
              const amount = log.args.amount!;
              const existing = userMap.get(user) ?? {
                totalBet: 0n,
                totalClaimed: 0n,
                bets: 0,
              };
              existing.totalClaimed += amount;
              userMap.set(user, existing);
            }
          } catch {
            // skip markets that fail log fetching
          }
        }),
      );

      return Array.from(userMap.entries())
        .map(([address, data]) => ({
          address,
          totalBet: data.totalBet,
          totalClaimed: data.totalClaimed,
          pnl: data.totalClaimed - data.totalBet,
          bets: data.bets,
        }))
        .sort((a, b) => {
          if (b.pnl > a.pnl) return 1;
          if (b.pnl < a.pnl) return -1;
          return 0;
        });
    },
    enabled: !!markets && markets.length > 0,
    refetchInterval: 60_000,
  });

  return (
    <div>
      <h1 className="mb-6 font-heading text-3xl font-extrabold">Leaderboard</h1>
      <p className="mb-6 font-body text-sm text-muted-foreground">
        Top traders ranked by PnL across all markets
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse border-2 border-border bg-muted"
            />
          ))}
        </div>
      ) : !leaderboard || leaderboard.length === 0 ? (
        <div className="border-2 border-border bg-muted p-8 text-center font-body text-sm font-bold text-muted-foreground">
          No trading activity yet
        </div>
      ) : (
        <div className="border-2 border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border bg-main">
                <th className="px-4 py-2 text-left font-heading text-xs font-extrabold">
                  Rank
                </th>
                <th className="px-4 py-2 text-left font-heading text-xs font-extrabold">
                  Trader
                </th>
                <th className="px-4 py-2 text-right font-heading text-xs font-extrabold">
                  Bets
                </th>
                <th className="px-4 py-2 text-right font-heading text-xs font-extrabold">
                  Total Bet
                </th>
                <th className="px-4 py-2 text-right font-heading text-xs font-extrabold">
                  Claimed
                </th>
                <th className="px-4 py-2 text-right font-heading text-xs font-extrabold">
                  PnL
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => (
                <LeaderboardRow key={entry.address} entry={entry} rank={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
