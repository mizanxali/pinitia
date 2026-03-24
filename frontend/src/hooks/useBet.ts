"use client";

import { useInterwovenKit } from "@initia/interwovenkit-react";
import { encodeFunctionData, parseEther } from "viem";
import { MarketABI } from "@/lib/abi";
import { CHAIN_ID } from "@/lib/contracts";
import { useQueryClient } from "@tanstack/react-query";

export function useBet(marketAddress: `0x${string}`) {
  const { initiaAddress, requestTxBlock } = useInterwovenKit();
  const queryClient = useQueryClient();

  const placeBet = async (isLong: boolean, amount: string) => {
    if (!initiaAddress) throw new Error("Wallet not connected");

    const data = encodeFunctionData({
      abi: MarketABI,
      functionName: isLong ? "betLong" : "betShort",
    });

    await requestTxBlock({
      chainId: CHAIN_ID,
      autoSign: true,
      feeDenom: "GAS",
      messages: [
        {
          typeUrl: "/minievm.evm.v1.MsgCall",
          value: {
            sender: initiaAddress.toLowerCase(),
            contractAddr: marketAddress,
            input: data.startsWith("0x") ? data : `0x${data}`,
            value: parseEther(amount).toString(),
            accessList: [],
            authList: [],
          },
        },
      ],
    });

    queryClient.invalidateQueries({ queryKey: ["marketInfo", marketAddress] });
    queryClient.invalidateQueries({
      queryKey: ["userPosition", marketAddress],
    });
  };

  return { placeBet };
}
