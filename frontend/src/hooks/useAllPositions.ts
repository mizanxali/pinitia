"use client";

import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, parseAbiItem } from "viem";
import { MINITIA_RPC_URL } from "@/lib/contracts";

const client = createPublicClient({
  transport: http(MINITIA_RPC_URL),
});

export interface BetEntry {
  user: `0x${string}`;
  isLong: boolean;
  amount: bigint;
}

export function useAllBets(marketAddress: `0x${string}`) {
  return useQuery({
    queryKey: ["allBets", marketAddress],
    queryFn: async (): Promise<BetEntry[]> => {
      const logs = await client.getLogs({
        address: marketAddress,
        event: parseAbiItem(
          "event BetPlaced(address indexed user, bool isLong, uint256 amount)",
        ),
        fromBlock: 0n,
        toBlock: "latest",
      });

      return logs.map((log) => ({
        user: log.args.user!.toLowerCase() as `0x${string}`,
        isLong: log.args.isLong!,
        amount: log.args.amount!,
      }));
    },
    refetchInterval: 30_000,
  });
}
