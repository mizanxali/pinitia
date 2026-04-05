"use client";

import { useInterwovenKit } from "@initia/interwovenkit-react";
import { MsgExecute } from "@initia/initia.proto/initia/move/v1/tx";
import { AccAddress } from "@initia/initia.js";
import { MODULE_ADDRESS, MODULE_NAME, CHAIN_ID } from "@/lib/contracts";
import { parseMin } from "@/lib/move";
import { useQueryClient } from "@tanstack/react-query";

export function useBet(marketId: number) {
  const { initiaAddress, requestTxBlock } = useInterwovenKit();
  const queryClient = useQueryClient();

  const placeBet = async (isLong: boolean, amount: string) => {
    if (!initiaAddress) throw new Error("Wallet not connected");

    const amountUmin = parseMin(amount);
    const functionName = isLong ? "bet_long" : "bet_short";

    // BCS encode args: module_addr (address), market_id (u64), amount (u64)
    // For entry functions via MsgExecute, args are BCS-serialized bytes
    const moduleAddrBytes = bcsEncodeAddress(MODULE_ADDRESS);
    const marketIdBytes = bcsEncodeU64(BigInt(marketId));
    const amountBytes = bcsEncodeU64(amountUmin);

    await requestTxBlock({
      chainId: CHAIN_ID,
      messages: [
        {
          typeUrl: "/initia.move.v1.MsgExecute",
          value: MsgExecute.fromPartial({
            sender: initiaAddress,
            moduleAddress: MODULE_ADDRESS,
            moduleName: MODULE_NAME,
            functionName,
            typeArgs: [],
            args: [moduleAddrBytes, marketIdBytes, amountBytes],
          }),
        },
      ],
    });

    queryClient.invalidateQueries({ queryKey: ["marketInfo", marketId] });
    queryClient.invalidateQueries({
      queryKey: ["userPosition", marketId],
    });
  };

  return { placeBet };
}

function bcsEncodeU64(value: bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, value, true); // little-endian
  return new Uint8Array(buf);
}

function bcsEncodeAddress(bech32Addr: string): Uint8Array {
  const hex = AccAddress.toHex(bech32Addr).replace("0x", "").padStart(64, "0");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
