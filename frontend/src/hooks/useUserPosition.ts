"use client";

import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http } from "viem";
import { MarketABI } from "@/lib/abi";
import { MINITIA_RPC_URL } from "@/lib/contracts";

const client = createPublicClient({
  transport: http(MINITIA_RPC_URL),
});

export interface UserPosition {
  marketAddress: `0x${string}`;
  longAmount: bigint;
  shortAmount: bigint;
  claimable: bigint;
}

export function useUserPosition(
  marketAddress: `0x${string}`,
  userAddress: `0x${string}` | undefined,
) {
  return useQuery({
    queryKey: ["userPosition", marketAddress, userAddress],
    queryFn: async (): Promise<UserPosition> => {
      const result = (await client.readContract({
        address: marketAddress,
        abi: MarketABI,
        functionName: "getUserPosition",
        args: [userAddress!],
      })) as [bigint, bigint, bigint];

      return {
        marketAddress,
        longAmount: result[0],
        shortAmount: result[1],
        claimable: result[2],
      };
    },
    enabled: !!userAddress,
    refetchInterval: 15_000,
  });
}
