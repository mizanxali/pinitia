"use client";

import { useMarketInfo } from "@/hooks/useMarkets";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useAllBets } from "@/hooks/useAllPositions";
import { useSnapshotHistory } from "@/hooks/useSnapshotHistory";
import { useClaim } from "@/hooks/useClaim";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import BetPanel from "@/components/BetPanel";
import SnapshotChart from "@/components/SnapshotChart";
import Link from "next/link";
import {
  formatGas,
  formatRating,
  getCountdown,
  getMarketStatus,
  shortenAddress,
} from "@/lib/utils";
import { useState } from "react";

export default function MarketDetail({ address }: { address: string }) {
  const marketAddress = address as `0x${string}`;
  const { data: market, isLoading } = useMarketInfo(marketAddress);
  const { initiaAddress, address: hexAddress } = useInterwovenKit();
  const { data: position } = useUserPosition(
    marketAddress,
    hexAddress as `0x${string}` | undefined,
  );
  const { claim } = useClaim(marketAddress);
  const { data: snapshots } = useSnapshotHistory(market?.placeId ?? "");
  const { data: allBets } = useAllBets(marketAddress);
  const [claiming, setClaiming] = useState(false);

  if (isLoading || !market) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse border-2 border-border bg-muted" />
        <div className="h-64 animate-pulse border-2 border-border bg-muted" />
      </div>
    );
  }

  const status = getMarketStatus(market.resolved, Number(market.resolveDate));
  const marketTypeLabel = market.marketType === 0 ? "VELOCITY" : "RATING";
  const chartMetric = market.marketType === 0 ? "review_count" : "rating";
  const targetLine =
    market.marketType === 1 ? Number(market.target) / 100 : undefined;

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await claim();
    } catch {
      // error handled in hook
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div>
      <Link
        href={`/venue/${encodeURIComponent(market.placeId)}`}
        className="mb-4 inline-block font-body text-sm font-bold text-muted-foreground hover:underline"
      >
        &larr; Back to venue
      </Link>

      {/* Market header */}
      <div className="mb-6 border-2 border-border bg-card p-6 shadow-neo">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`border-2 border-border px-3 py-1 text-sm font-bold ${
              market.marketType === 0 ? "bg-blue-300" : "bg-purple-300"
            }`}
          >
            {marketTypeLabel}
          </span>
          <span
            className={`border-2 border-border px-3 py-1 text-sm font-bold ${
              status === "active"
                ? "bg-green-300"
                : status === "pending"
                  ? "bg-yellow-200"
                  : "bg-muted"
            }`}
          >
            {status.toUpperCase()}
          </span>
          <span className="font-body text-sm font-bold">
            {getCountdown(Number(market.resolveDate))}
          </span>
        </div>

        <h1 className="mt-3 font-heading text-2xl font-extrabold">
          {market.marketType === 0
            ? `Will this venue gain ${market.target.toString()} reviews?`
            : `Will the rating reach ${formatRating(market.target)}?`}
        </h1>

        {/* Stats grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border-2 border-border bg-background p-3">
            <p className="font-body text-xs text-muted-foreground">Target</p>
            <p className="font-heading text-lg font-extrabold">
              {market.marketType === 0
                ? market.target.toString()
                : formatRating(market.target)}
            </p>
          </div>
          <div className="border-2 border-border bg-background p-3">
            <p className="font-body text-xs text-muted-foreground">
              Total Pool
            </p>
            <p className="font-heading text-lg font-extrabold">
              {formatGas(market.longPool + market.shortPool)} GAS
            </p>
          </div>
          <div className="border-2 border-border bg-background p-3">
            <p className="font-body text-xs text-muted-foreground">
              Resolve Date
            </p>
            <p className="font-heading text-sm font-extrabold">
              {new Date(Number(market.resolveDate) * 1000).toLocaleDateString()}
            </p>
          </div>
          <div className="border-2 border-border bg-background p-3">
            <p className="font-body text-xs text-muted-foreground">
              Initial Reviews
            </p>
            <p className="font-heading text-lg font-extrabold">
              {market.initialReviewCount.toString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-heading text-xl font-extrabold">
            Progress Chart
          </h2>
          <SnapshotChart
            snapshots={snapshots ?? []}
            metric={chartMetric}
            targetLine={targetLine}
          />

          {/* Resolved info */}
          {market.resolved && (
            <div className="mt-4 border-2 border-border bg-yellow-200 p-4">
              <h3 className="font-heading text-lg font-extrabold">
                Market Resolved
              </h3>
              <p className="mt-1 font-body text-sm font-bold">
                Final Rating: {formatRating(market.finalRating)} | Final
                Reviews: {market.finalReviewCount.toString()}
              </p>
              <p className="mt-1 font-body text-sm font-bold">
                Result:{" "}
                <span
                  className={
                    market.longWins ? "text-green-700" : "text-red-700"
                  }
                >
                  {market.longWins ? "LONG WINS" : "SHORT WINS"}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Bet panel + Position */}
        <div className="space-y-4">
          <BetPanel market={market} />

          {/* User position */}
          {initiaAddress &&
            position &&
            (position.longAmount > 0n || position.shortAmount > 0n) && (
              <div className="border-2 border-border bg-card p-5 shadow-neo-sm">
                <h3 className="font-heading text-lg font-extrabold">
                  Your Position
                </h3>
                <div className="mt-3 space-y-2">
                  {position.longAmount > 0n && (
                    <div className="flex justify-between border-2 border-border bg-green-100 px-3 py-2">
                      <span className="font-body text-sm font-bold">LONG</span>
                      <span className="font-body text-sm font-bold">
                        {formatGas(position.longAmount)} GAS
                      </span>
                    </div>
                  )}
                  {position.shortAmount > 0n && (
                    <div className="flex justify-between border-2 border-border bg-red-100 px-3 py-2">
                      <span className="font-body text-sm font-bold">SHORT</span>
                      <span className="font-body text-sm font-bold">
                        {formatGas(position.shortAmount)} GAS
                      </span>
                    </div>
                  )}
                  {position.claimable > 0n && (
                    <button
                      type="button"
                      onClick={handleClaim}
                      disabled={claiming}
                      className="w-full border-2 border-border bg-yellow-200 px-4 py-3 font-heading text-sm font-extrabold shadow-neo-sm transition-all hover:neo-press disabled:opacity-50"
                    >
                      {claiming
                        ? "Claiming..."
                        : `Claim ${formatGas(position.claimable)} GAS`}
                    </button>
                  )}
                </div>
              </div>
            )}
        </div>
      </div>

      {/* All Bets */}
      {allBets && allBets.length > 0 && (
        <div className="mt-6 border-2 border-border bg-card p-5 shadow-neo">
          <h2 className="mb-4 font-heading text-xl font-extrabold">All Bets</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="px-3 py-2 text-left font-heading text-sm font-extrabold">
                    Trader
                  </th>
                  <th className="px-3 py-2 text-left font-heading text-sm font-extrabold">
                    Side
                  </th>
                  <th className="px-3 py-2 text-right font-heading text-sm font-extrabold">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {allBets.map((bet, i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-3 py-2 font-body text-sm font-bold">
                      {shortenAddress(bet.user)}
                      {hexAddress &&
                        bet.user.toLowerCase() === hexAddress.toLowerCase() && (
                          <span className="ml-2 border-2 border-border bg-blue-200 px-1.5 py-0.5 text-xs font-bold">
                            YOU
                          </span>
                        )}
                    </td>
                    <td className="px-3 py-2 font-body text-sm font-bold">
                      <span
                        className={`border-2 border-border px-2 py-0.5 text-xs font-bold ${
                          bet.isLong ? "bg-green-200" : "bg-red-200"
                        }`}
                      >
                        {bet.isLong ? "LONG" : "SHORT"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-body text-sm font-bold">
                      {formatGas(bet.amount)} GAS
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
