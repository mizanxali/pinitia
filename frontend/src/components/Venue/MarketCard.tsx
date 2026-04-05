"use client";

import Link from "next/link";
import { type MarketInfo } from "@/hooks/useMarkets";
import {
  formatMin,
  formatRating,
  getCountdown,
  getMarketStatus,
} from "@/lib/utils";

interface MarketCardProps {
  market: MarketInfo;
  showPlaceId?: boolean;
}

export default function MarketCard({ market, showPlaceId }: MarketCardProps) {
  const status = getMarketStatus(market.resolved, Number(market.resolveDate));
  const totalPool = market.longPool + market.shortPool;
  const longPct =
    totalPool > 0n ? Number((market.longPool * 100n) / totalPool) : 50;

  const marketTypeLabel = market.marketType === 0 ? "VELOCITY" : "RATING";
  const targetLabel =
    market.marketType === 0
      ? `Will this place gain ${market.target.toString()} new reviews?`
      : `Will this place have a rating of ${formatRating(market.target)}?`;

  return (
    <Link href={`/market/${market.marketId}`}>
      <div className="group cursor-pointer border-2 border-border bg-card p-4 shadow-neo-sm transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-pressed">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`border-2 border-border px-2 py-0.5 text-xs font-bold ${
                market.marketType === 0 ? "bg-blue-300" : "bg-purple-300"
              }`}
            >
              {marketTypeLabel}
            </span>
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
          </div>
          <span className="font-body text-xs font-bold text-muted-foreground">
            {getCountdown(Number(market.resolveDate))}
          </span>
        </div>

        {showPlaceId && (
          <p className="mt-2 font-body text-xs text-muted-foreground truncate">
            {market.placeId}
          </p>
        )}

        <p className="mt-2 font-heading text-sm font-bold">{targetLabel}</p>

        {/* Pool bar */}
        <div className="mt-3">
          <div className="flex justify-between font-body text-xs font-semibold">
            <span className="text-green-700">
              YES {formatMin(market.longPool)}
            </span>
            <span className="text-red-600">
              NO {formatMin(market.shortPool)}
            </span>
          </div>
          <div className="mt-1 flex h-3 border-2 border-border">
            <div
              className="bg-green-400 transition-all"
              style={{ width: `${longPct}%` }}
            />
            <div
              className="bg-red-400 transition-all"
              style={{ width: `${100 - longPct}%` }}
            />
          </div>
          <p className="mt-1 text-center font-body text-xs font-bold text-muted-foreground">
            Total: {formatMin(totalPool)} MIN
          </p>
        </div>

        {market.resolved && (
          <div className="mt-2 border-2 border-border bg-yellow-200 p-2 text-center text-xs font-bold">
            {`Resolved — ${market.longWins ? "YES WINS" : "NO WINS"}`}
          </div>
        )}
      </div>
    </Link>
  );
}
