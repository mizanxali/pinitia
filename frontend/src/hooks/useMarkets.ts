"use client";

import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http } from "viem";
import { MarketFactoryABI, MarketABI } from "@/lib/abi";
import { MARKET_FACTORY_ADDRESS, MINITIA_RPC_URL } from "@/lib/contracts";

const client = createPublicClient({
  transport: http(MINITIA_RPC_URL),
});

export interface MarketInfo {
  address: `0x${string}`;
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

async function fetchMarketInfo(
  marketAddress: `0x${string}`,
): Promise<MarketInfo> {
  const result = (await client.readContract({
    address: marketAddress,
    abi: MarketABI,
    functionName: "getMarketInfo",
  })) as [
    number,
    string,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    boolean,
  ];

  const resolved = result[9];

  let longWins = false;
  if (resolved) {
    longWins = (await client.readContract({
      address: marketAddress,
      abi: MarketABI,
      functionName: "longWins",
    })) as boolean;
  }

  return {
    address: marketAddress,
    marketType: result[0],
    placeId: result[1],
    target: result[2],
    resolveDate: result[3],
    longPool: result[4],
    shortPool: result[5],
    initialReviewCount: result[6],
    finalRating: result[7],
    finalReviewCount: result[8],
    resolved,
    longWins,
  };
}

export function useActiveMarkets() {
  return useQuery({
    queryKey: ["activeMarkets"],
    queryFn: async () => {
      const addresses = (await client.readContract({
        address: MARKET_FACTORY_ADDRESS,
        abi: MarketFactoryABI,
        functionName: "getActiveMarkets",
      })) as `0x${string}`[];

      const markets = await Promise.all(addresses.map(fetchMarketInfo));
      return markets;
    },
    refetchInterval: 30_000,
  });
}

export function useMarketInfo(address: `0x${string}`) {
  return useQuery({
    queryKey: ["marketInfo", address],
    queryFn: () => fetchMarketInfo(address),
    refetchInterval: 15_000,
  });
}

export function usePlaceMarkets(placeId: string) {
  return useQuery({
    queryKey: ["placeMarkets", placeId],
    queryFn: async () => {
      const addresses = (await client.readContract({
        address: MARKET_FACTORY_ADDRESS,
        abi: MarketFactoryABI,
        functionName: "getMarketsByPlace",
        args: [placeId],
      })) as `0x${string}`[];

      return Promise.all(addresses.map(fetchMarketInfo));
    },
    refetchInterval: 30_000,
  });
}
