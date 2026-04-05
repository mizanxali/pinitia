"use client";

import { useInterwovenKit } from "@initia/interwovenkit-react";
import { MsgExecute } from "@initia/initia.proto/initia/move/v1/tx";
import { MODULE_ADDRESS, MODULE_NAME, CHAIN_ID } from "@/lib/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { AccAddress } from "@initia/initia.js";

export function useClaim(marketId: number) {
  const { initiaAddress, requestTxBlock } = useInterwovenKit();
  const queryClient = useQueryClient();

  const claim = async () => {
    if (!initiaAddress) throw new Error("Wallet not connected");

    const moduleAddrBytes = bcsEncodeAddress(MODULE_ADDRESS);
    const marketIdBytes = bcsEncodeU64(BigInt(marketId));

    await requestTxBlock({
      chainId: CHAIN_ID,
      messages: [
        {
          typeUrl: "/initia.move.v1.MsgExecute",
          value: MsgExecute.fromPartial({
            sender: initiaAddress,
            moduleAddress: MODULE_ADDRESS,
            moduleName: MODULE_NAME,
            functionName: "claim",
            typeArgs: [],
            args: [moduleAddrBytes, marketIdBytes],
          }),
        },
      ],
    });

    queryClient.invalidateQueries({
      queryKey: ["userPosition", marketId],
    });
  };

  return { claim };
}

function bcsEncodeU64(value: bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, value, true);
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
