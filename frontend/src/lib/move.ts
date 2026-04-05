import { RESTClient, AccAddress } from "@initia/initia.js";
import { REST_URL, MODULE_ADDRESS, MODULE_NAME, CHAIN_ID } from "./contracts";

export const rest = new RESTClient(REST_URL, { chainId: CHAIN_ID });

/**
 * Encode a bech32 address as a base64 argument for Move view functions.
 * Address args must be 32-byte padded hex, then base64 encoded.
 */
export function encodeAddressArg(bech32Addr: string): string {
  const hexAddr = AccAddress.toHex(bech32Addr)
    .replace("0x", "")
    .padStart(64, "0");
  return Buffer.from(hexAddr, "hex").toString("base64");
}

/**
 * Encode a u64 as a base64 argument for Move view functions.
 * u64 is BCS-encoded as little-endian 8 bytes.
 */
export function encodeU64Arg(value: number | bigint): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf.toString("base64");
}

/**
 * Encode a string as a base64 argument for Move view functions.
 * Strings are BCS-encoded as length-prefixed bytes.
 */
export function encodeStringArg(value: string): string {
  const strBytes = Buffer.from(value, "utf-8");
  // BCS string: ULEB128 length prefix + raw bytes
  const lenBytes = ulebEncode(strBytes.length);
  const buf = Buffer.concat([Buffer.from(lenBytes), strBytes]);
  return buf.toString("base64");
}

function ulebEncode(value: number): number[] {
  const result: number[] = [];
  while (value >= 0x80) {
    result.push((value & 0x7f) | 0x80);
    value >>= 7;
  }
  result.push(value);
  return result;
}

/**
 * Call a Move view function and parse the JSON response.
 */
export async function moveView(
  functionName: string,
  typeArgs: string[] = [],
  args: string[] = [],
): Promise<string[]> {
  const res = await rest.move.view(
    MODULE_ADDRESS,
    MODULE_NAME,
    functionName,
    typeArgs,
    args,
  );
  // res.data is a JSON string like '["value1", "value2"]'
  return JSON.parse(res.data);
}

/**
 * Parse a Move u64 string value to bigint.
 */
export function parseU64(value: string): bigint {
  return BigInt(value);
}

/**
 * Format umin (6 decimals) to human-readable string.
 */
export function formatMin(umin: bigint): string {
  const min = Number(umin) / 1e6;
  if (min >= 1) return min.toFixed(2);
  if (min >= 0.01) return min.toFixed(4);
  return min.toFixed(6);
}

/**
 * Parse a human-readable MIN amount to umin (6 decimals).
 */
export function parseMin(amount: string): bigint {
  return BigInt(Math.round(parseFloat(amount) * 1e6));
}
