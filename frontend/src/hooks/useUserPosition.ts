"use client";

import { useQuery } from "@tanstack/react-query";
import { moveView, encodeU64Arg, encodeAddressArg, parseU64 } from "@/lib/move";

export interface UserPosition {
  marketId: number;
  longAmount: bigint;
  shortAmount: bigint;
  claimable: bigint;
}

export function useUserPosition(
  marketId: number,
  userAddress: string | undefined,
) {
  return useQuery({
    queryKey: ["userPosition", marketId, userAddress],
    queryFn: async (): Promise<UserPosition> => {
      // get_user_position(module_addr, market_id, user) -> (u64, u64, u64)
      const result = await moveView(
        "get_user_position",
        [],
        [encodeU64Arg(marketId), encodeAddressArg(userAddress!)],
      );

      return {
        marketId,
        longAmount: parseU64(result[0]),
        shortAmount: parseU64(result[1]),
        claimable: parseU64(result[2]),
      };
    },
    enabled: !!userAddress,
    refetchInterval: 15_000,
  });
}
