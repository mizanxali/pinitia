"use client";

import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useActiveMarkets, type MarketInfo } from "@/hooks/useMarkets";
import { useQuery } from "@tanstack/react-query";
import { moveView, encodeU64Arg, encodeAddressArg, parseU64 } from "@/lib/move";
import { useClaim } from "@/hooks/useClaim";
import { formatMin, getMarketStatus, formatRating } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

interface PositionWithMarket {
  market: MarketInfo;
  longAmount: bigint;
  shortAmount: bigint;
  claimable: bigint;
}

function ClaimButton({ marketId }: { marketId: number }) {
  const { claim } = useClaim(marketId);
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        setLoading(true);
        try {
          await claim();
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="border-2 border-border bg-yellow-200 px-3 py-1 text-xs font-bold shadow-neo-sm transition-all hover:neo-press disabled:opacity-50"
    >
      {loading ? "..." : "Claim"}
    </button>
  );
}

export default function PortfolioContent() {
  const { initiaAddress, openConnect } = useInterwovenKit();
  const { data: markets } = useActiveMarkets();

  const { data: positions, isLoading } = useQuery({
    queryKey: ["allPositions", initiaAddress, markets?.map((m) => m.marketId)],
    queryFn: async (): Promise<PositionWithMarket[]> => {
      if (!markets || !initiaAddress) return [];
      const results = await Promise.all(
        markets.map(async (market) => {
          try {
            const result = await moveView(
              "get_user_position",
              [],
              [encodeU64Arg(market.marketId), encodeAddressArg(initiaAddress)],
            );

            return {
              market,
              longAmount: parseU64(result[0]),
              shortAmount: parseU64(result[1]),
              claimable: parseU64(result[2]),
            };
          } catch {
            return {
              market,
              longAmount: 0n,
              shortAmount: 0n,
              claimable: 0n,
            };
          }
        }),
      );
      return results.filter((p) => p.longAmount > 0n || p.shortAmount > 0n);
    },
    enabled: !!initiaAddress && !!markets,
    refetchInterval: 30_000,
  });

  if (!initiaAddress) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h1 className="mb-4 font-heading text-3xl font-extrabold">Portfolio</h1>
        <p className="mb-6 font-body text-muted-foreground">
          Connect your wallet to view your positions
        </p>
        <button
          type="button"
          onClick={openConnect}
          className="border-2 border-border bg-primary px-6 py-3 font-heading font-extrabold shadow-neo transition-all hover:neo-press"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  const totalInvested =
    positions?.reduce((sum, p) => sum + p.longAmount + p.shortAmount, 0n) ?? 0n;
  const totalClaimable =
    positions?.reduce((sum, p) => sum + p.claimable, 0n) ?? 0n;

  return (
    <div>
      <h1 className="mb-6 font-heading text-3xl font-extrabold">Portfolio</h1>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border-2 border-border bg-card p-4 shadow-neo-sm">
          <p className="font-body text-xs text-muted-foreground">Positions</p>
          <p className="font-heading text-2xl font-extrabold">
            {positions?.length ?? 0}
          </p>
        </div>
        <div className="border-2 border-border bg-card p-4 shadow-neo-sm">
          <p className="font-body text-xs text-muted-foreground">
            Total Invested
          </p>
          <p className="font-heading text-2xl font-extrabold">
            {formatMin(totalInvested)} MIN
          </p>
        </div>
        <div className="border-2 border-border bg-yellow-200 p-4 shadow-neo-sm">
          <p className="font-body text-xs text-muted-foreground">Claimable</p>
          <p className="font-heading text-2xl font-extrabold">
            {formatMin(totalClaimable)} MIN
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse border-2 border-border bg-muted"
            />
          ))}
        </div>
      ) : !positions || positions.length === 0 ? (
        <div className="border-2 border-border bg-muted p-8 text-center font-body text-sm font-bold text-muted-foreground">
          No positions yet. Browse{" "}
          <Link href="/" className="text-primary underline">
            places
          </Link>{" "}
          to place your first bet.
        </div>
      ) : (
        <div className="border-2 border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border bg-main">
                <th className="px-4 py-2 text-left font-heading text-xs font-extrabold">
                  Market
                </th>
                <th className="px-4 py-2 text-left font-heading text-xs font-extrabold">
                  Type
                </th>
                <th className="px-4 py-2 text-left font-heading text-xs font-extrabold">
                  Status
                </th>
                <th className="px-4 py-2 text-right font-heading text-xs font-extrabold">
                  YES
                </th>
                <th className="px-4 py-2 text-right font-heading text-xs font-extrabold">
                  NO
                </th>
                <th className="px-4 py-2 text-right font-heading text-xs font-extrabold">
                  Claimable
                </th>
                <th className="px-4 py-2 font-heading text-xs font-extrabold" />
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const status = getMarketStatus(
                  p.market.resolved,
                  Number(p.market.resolveDate),
                );
                return (
                  <tr
                    key={p.market.marketId}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/market/${p.market.marketId}`}
                        className="font-body text-sm font-bold hover:underline"
                      >
                        {p.market.marketType === 0
                          ? `${p.market.target.toString()} reviews`
                          : `Rating ${formatRating(p.market.target)}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`border-2 border-border px-2 py-0.5 text-xs font-bold ${
                          p.market.marketType === 0
                            ? "bg-blue-300"
                            : "bg-purple-300"
                        }`}
                      >
                        {p.market.marketType === 0 ? "VEL" : "RAT"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`border-2 border-border px-2 py-0.5 text-xs font-bold ${
                          status === "active"
                            ? "bg-green-300"
                            : status === "pending"
                              ? "bg-yellow-200"
                              : "bg-muted"
                        }`}
                      >
                        {status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-body text-sm font-bold text-green-700">
                      {p.longAmount > 0n ? formatMin(p.longAmount) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-sm font-bold text-red-600">
                      {p.shortAmount > 0n ? formatMin(p.shortAmount) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-sm font-extrabold">
                      {p.claimable > 0n ? formatMin(p.claimable) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {p.claimable > 0n && (
                        <ClaimButton marketId={p.market.marketId} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
