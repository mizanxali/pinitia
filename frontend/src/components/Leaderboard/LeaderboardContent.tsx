"use client";

import { useActiveMarkets } from "@/hooks/useMarkets";
import { useQuery } from "@tanstack/react-query";
import { moveView, encodeU64Arg } from "@/lib/move";
import { formatMin, shortenAddress } from "@/lib/utils";
import { useUsernameQuery } from "@initia/interwovenkit-react";

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
        {formatMin(entry.totalBet)}
      </td>
      <td className="px-4 py-3 text-right font-body text-sm">
        {formatMin(entry.totalClaimed)}
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
        {formatMin(entry.pnl)} MIN
      </td>
    </tr>
  );
}

export default function LeaderboardContent() {
  const { data: markets } = useActiveMarkets();

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["leaderboard", markets?.map((m) => m.marketId)],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      if (!markets || markets.length === 0) return [];

      const userMap = new Map<
        string,
        { totalBet: bigint; totalClaimed: bigint; bets: number }
      >();

      await Promise.all(
        markets.map(async (market) => {
          try {
            // Get all bet entries from the view function
            const bets = await moveView(
              "get_market_bets",
              [],
              [encodeU64Arg(market.marketId)],
            );

            for (const bet of bets as unknown as Array<{
              user: string;
              is_long: boolean;
              amount: string;
            }>) {
              const user = bet.user;
              const amount = BigInt(bet.amount);
              const existing = userMap.get(user) ?? {
                totalBet: 0n,
                totalClaimed: 0n,
                bets: 0,
              };
              existing.totalBet += amount;
              existing.bets += 1;
              userMap.set(user, existing);
            }
            // Note: claimed amounts would need a separate tracking mechanism
            // For now, leaderboard shows bet volume only
          } catch {
            // skip markets that fail
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
