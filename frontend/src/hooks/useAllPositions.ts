"use client";

import { useQuery } from "@tanstack/react-query";
import { moveView, encodeU64Arg } from "@/lib/move";

export interface BetEntry {
  user: string;
  isLong: boolean;
  amount: bigint;
}

export function useAllBets(marketId: number) {
  return useQuery({
    queryKey: ["allBets", marketId],
    queryFn: async (): Promise<BetEntry[]> => {
      // get_market_bets returns vector<BetEntry { user, is_long, amount }>
      const result = await moveView(
        "get_market_bets",
        [],
        [encodeU64Arg(marketId)],
      );

      // Result is an array of BetEntry structs serialized as JSON objects
      return (
        result as unknown as Array<{
          user: string;
          is_long: boolean;
          amount: string;
        }>
      ).map((entry) => ({
        user: entry.user,
        isLong: entry.is_long,
        amount: BigInt(entry.amount),
      }));
    },
    refetchInterval: 30_000,
  });
}
