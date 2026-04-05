"use client";

import { useQuery } from "@tanstack/react-query";
import { moveView, encodeU64Arg, encodeStringArg, parseU64 } from "@/lib/move";

export interface MarketInfo {
  marketId: number;
  marketType: number;
  placeId: string;
  target: bigint;
  resolveDate: bigint;
  longPool: bigint;
  shortPool: bigint;
  initialReviewCount: bigint;
  finalRating: bigint;
  finalReviewCount: bigint;
  resolved: boolean;
  longWins: boolean;
}

async function fetchMarketInfo(marketId: number): Promise<MarketInfo> {
  // get_market_info returns (u8, String, u64, u64, u64, u64, u64, u64, u64, bool, bool)
  const result = await moveView(
    "get_market_info",
    [],
    [encodeU64Arg(marketId)],
  );

  return {
    marketId,
    marketType: Number(result[0]),
    placeId: result[1],
    target: parseU64(result[2]),
    resolveDate: parseU64(result[3]),
    longPool: parseU64(result[4]),
    shortPool: parseU64(result[5]),
    initialReviewCount: parseU64(result[6]),
    finalRating: parseU64(result[7]),
    finalReviewCount: parseU64(result[8]),
    resolved: String(result[9]) === "true",
    longWins: String(result[10]) === "true",
  };
}

export function useActiveMarkets() {
  return useQuery({
    queryKey: ["activeMarkets"],
    queryFn: async () => {
      // get_active_markets returns vector<u64>
      const result = await moveView("get_active_markets");
      const marketIds = (result as unknown as string[]).map(Number);
      const markets = await Promise.all(marketIds.map(fetchMarketInfo));
      return markets;
    },
    refetchInterval: 30_000,
  });
}

export function useMarketInfo(marketId: number) {
  return useQuery({
    queryKey: ["marketInfo", marketId],
    queryFn: () => fetchMarketInfo(marketId),
    refetchInterval: 15_000,
  });
}

export function usePlaceMarkets(placeId: string) {
  return useQuery({
    queryKey: ["placeMarkets", placeId],
    queryFn: async () => {
      const result = await moveView(
        "get_markets_by_place",
        [],
        [encodeStringArg(placeId)],
      );
      const marketIds = (result as unknown as string[]).map(Number);
      return Promise.all(marketIds.map(fetchMarketInfo));
    },
    refetchInterval: 30_000,
  });
}
