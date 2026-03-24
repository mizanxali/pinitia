"use client";

import { useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useBet } from "@/hooks/useBet";
import { type MarketInfo } from "@/hooks/useMarkets";
import { formatGas, getMarketStatus } from "@/lib/utils";

interface BetPanelProps {
  market: MarketInfo;
}

export default function BetPanel({ market }: BetPanelProps) {
  const { initiaAddress, openConnect } = useInterwovenKit();
  const { placeBet } = useBet(market.address);
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = getMarketStatus(market.resolved, Number(market.resolveDate));
  const canBet = status === "active" && !!initiaAddress;

  const totalPool = market.longPool + market.shortPool;
  const longPct =
    totalPool > 0n ? Number((market.longPool * 100n) / totalPool) : 50;

  const handleBet = async (isLong: boolean) => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await placeBet(isLong, amount);
      setAmount("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border-2 border-border bg-card p-5 shadow-neo">
      <h3 className="font-heading text-lg font-extrabold">Place Your Bet</h3>

      {/* Pool visualization */}
      <div className="mt-4">
        <div className="flex justify-between font-body text-xs font-bold">
          <span className="text-green-700">
            LONG {formatGas(market.longPool)} GAS
          </span>
          <span className="text-red-600">
            SHORT {formatGas(market.shortPool)} GAS
          </span>
        </div>
        <div className="mt-1 flex h-5 border-2 border-border">
          <div
            className="flex items-center justify-center bg-green-400 text-[10px] font-bold"
            style={{ width: `${Math.max(longPct, 5)}%` }}
          >
            {longPct}%
          </div>
          <div
            className="flex items-center justify-center bg-red-400 text-[10px] font-bold"
            style={{ width: `${Math.max(100 - longPct, 5)}%` }}
          >
            {100 - longPct}%
          </div>
        </div>
      </div>

      {/* Amount input */}
      <div className="mt-4">
        <label className="font-body text-sm font-bold">Amount (GAS)</label>
        <div className="mt-1 flex border-2 border-border">
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={!canBet}
            className="flex-1 bg-background px-3 py-2 font-body text-sm font-semibold outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          <span className="flex items-center bg-muted px-3 font-body text-sm font-bold">
            GAS
          </span>
        </div>
      </div>

      {error && (
        <p className="mt-2 font-body text-xs font-bold text-red-600">{error}</p>
      )}

      {/* Bet buttons */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {!initiaAddress ? (
          <button
            type="button"
            onClick={openConnect}
            className="col-span-2 border-2 border-border bg-primary px-4 py-3 font-heading text-sm font-extrabold shadow-neo-sm transition-all hover:neo-press"
          >
            Connect Wallet to Bet
          </button>
        ) : status !== "active" ? (
          <div className="col-span-2 border-2 border-border bg-muted p-3 text-center font-body text-sm font-bold text-muted-foreground">
            {status === "resolved" ? "Market Resolved" : "Betting Period Ended"}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => handleBet(true)}
              disabled={isSubmitting || !canBet}
              className="border-2 border-border bg-green-300 px-4 py-3 font-heading text-sm font-extrabold shadow-neo-sm transition-all hover:neo-press disabled:opacity-50"
            >
              {isSubmitting ? "..." : "LONG"}
            </button>
            <button
              type="button"
              onClick={() => handleBet(false)}
              disabled={isSubmitting || !canBet}
              className="border-2 border-border bg-red-300 px-4 py-3 font-heading text-sm font-extrabold shadow-neo-sm transition-all hover:neo-press disabled:opacity-50"
            >
              {isSubmitting ? "..." : "SHORT"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
