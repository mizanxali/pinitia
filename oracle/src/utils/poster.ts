import { execSync } from "node:child_process";
import { config } from "./config.js";

/**
 * Execute a minitiad CLI command and return stdout.
 */
function minitiad(args: string): string {
  const cmd = `minitiad ${args}`;
  console.log(`  > ${cmd}`);
  return execSync(cmd, { encoding: "utf-8", timeout: 30_000 }).trim();
}

/**
 * Execute a Move entry function via minitiad tx.
 */
function moveExecute(functionName: string, args: string[]): string {
  const argsJson = JSON.stringify(args);
  return minitiad(
    `tx move execute ${config.moduleAddress} ${config.moduleName} ${functionName} ` +
      `--args '${argsJson}' ` +
      `--from ${config.oracleKeyName} --keyring-backend test ` +
      `--chain-id ${config.chainId} ` +
      `--gas auto --gas-adjustment 1.4 --yes -o json`,
  );
}

/**
 * Call a Move view function via REST.
 */
async function moveView(
  functionName: string,
  args: string[] = [],
): Promise<string[]> {
  const body = {
    address: config.moduleAddress,
    module_name: config.moduleName,
    function_name: functionName,
    type_args: [],
    args: args,
  };

  const res = await fetch(`${config.restUrl}/initia/move/v1/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(
      `View ${functionName} failed: ${res.status} ${await res.text()}`,
    );
  }

  const json = await res.json();
  return JSON.parse(json.data);
}

/**
 * Encode a u64 value as base64 for view function args.
 */
function encodeU64(value: number | bigint): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf.toString("base64");
}

/**
 * Encode a bech32 address as base64 for view function args.
 * Decodes bech32 to raw bytes, pads to 32 bytes, then base64 encodes.
 */
function encodeAddress(bech32Addr: string): string {
  // Decode bech32: find separator (last '1'), decode 5-bit words to 8-bit bytes
  const sepIdx = bech32Addr.lastIndexOf("1");
  const data = bech32Addr.slice(sepIdx + 1, -6); // strip prefix and 6-char checksum
  const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const words = [...data].map((c) => CHARSET.indexOf(c));
  // Convert 5-bit groups to 8-bit bytes
  let acc = 0,
    bits = 0;
  const bytes: number[] = [];
  for (const w of words) {
    acc = (acc << 5) | w;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  // Pad to 32 bytes (left-pad with zeros)
  const padded = Buffer.alloc(32);
  Buffer.from(bytes).copy(padded, 32 - bytes.length);
  return padded.toString("base64");
}

/**
 * Encode a string as BCS base64 for view function args.
 */
function encodeString(value: string): string {
  const strBytes = Buffer.from(value, "utf-8");
  const lenBytes: number[] = [];
  let len = strBytes.length;
  while (len >= 0x80) {
    lenBytes.push((len & 0x7f) | 0x80);
    len >>= 7;
  }
  lenBytes.push(len);
  return Buffer.concat([Buffer.from(lenBytes), strBytes]).toString("base64");
}

// ========== Public API ==========

/**
 * Post place data on-chain. The Move module auto-resolves any
 * eligible markets (those past their resolveDate) for the given placeId.
 */
export function postOnChain(data: {
  placeId: string;
  rating: number;
  reviewCount: number;
}) {
  const ratingScaled = Math.round(data.rating * 100);
  moveExecute("post_place_data", [
    `address:${config.moduleAddress}`,
    `string:${data.placeId}`,
    `u64:${ratingScaled}`,
    `u64:${data.reviewCount}`,
  ]);
  console.log(
    `Posted on-chain: ${data.placeId} rating=${data.rating} reviews=${data.reviewCount}`,
  );
}

/**
 * Batch-post multiple places in a single tx.
 */
export function batchPostOnChain(
  items: { placeId: string; rating: number; reviewCount: number }[],
) {
  const placeIds = items.map((d) => d.placeId).join(",");
  const ratings = items.map((d) => Math.round(d.rating * 100)).join(",");
  const reviewCounts = items.map((d) => d.reviewCount).join(",");
  moveExecute("batch_post", [
    `address:${config.moduleAddress}`,
    `vector<string>:${placeIds}`,
    `vector<u64>:${ratings}`,
    `vector<u64>:${reviewCounts}`,
  ]);
  console.log(`Batch posted ${items.length} places on-chain`);
}

/**
 * Get all active market IDs from the module.
 */
export async function getActiveMarkets(): Promise<number[]> {
  const result = await moveView("get_active_markets", [
    encodeAddress(config.moduleAddress),
  ]);
  return (result as unknown as string[]).map(Number);
}

/**
 * Read market info.
 */
export async function getMarketInfo(marketId: number) {
  const result = await moveView("get_market_info", [
    encodeAddress(config.moduleAddress),
    encodeU64(marketId),
  ]);
  return {
    marketType: Number(result[0]),
    placeId: result[1] as string,
    target: BigInt(result[2]),
    resolveDate: Number(result[3]),
    initialReviewCount: BigInt(result[6]),
    resolved: String(result[9]) === "true",
  };
}

/**
 * Check whether a resolved market was won by LONG.
 */
export async function getMarketResult(marketId: number): Promise<boolean> {
  const result = await moveView("get_market_info", [
    encodeAddress(config.moduleAddress),
    encodeU64(marketId),
  ]);
  return String(result[10]) === "true";
}

const FOLLOW_UP_RESOLVE_OFFSET = 60 * 60; // 1 hour
const VELOCITY_TARGET_BUMP = 10n;
const RATING_TARGET_BUMP = 10n; // scaled 1e2, so 10 = 0.1
const MAX_RATING_SCALED = 500n;

/**
 * Create a follow-up market after resolution.
 */
export function createFollowUpMarket(
  marketId: number,
  info: {
    marketType: number;
    placeId: string;
    target: bigint;
    initialReviewCount: bigint;
  },
  longWins: boolean,
  currentReviewCount: number,
) {
  const resolveDate = Math.floor(Date.now() / 1000) + FOLLOW_UP_RESOLVE_OFFSET;
  const isVelocity = info.marketType === 0;

  let newTarget = info.target;
  if (longWins) {
    newTarget = isVelocity
      ? info.target + VELOCITY_TARGET_BUMP
      : info.target + RATING_TARGET_BUMP;
  }

  if (!isVelocity && newTarget > MAX_RATING_SCALED) {
    newTarget = MAX_RATING_SCALED;
  }

  try {
    if (isVelocity) {
      moveExecute("create_velocity_market", [
        `string:${info.placeId}`,
        `u64:${newTarget.toString()}`,
        `u64:${resolveDate}`,
        `u64:${currentReviewCount}`,
      ]);
    } else {
      moveExecute("create_rating_market", [
        `string:${info.placeId}`,
        `u64:${newTarget.toString()}`,
        `u64:${resolveDate}`,
      ]);
    }
    const typeLabel = isVelocity ? "VELOCITY" : "RATING";
    const action = longWins ? "bumped" : "same";
    console.log(
      `  Follow-up: ${typeLabel} target=${newTarget.toString()} (${action}) resolves=${new Date(resolveDate * 1000).toISOString()}`,
    );
  } catch (err: any) {
    if (err.message?.includes("Max markets")) {
      console.log(
        `  Follow-up skipped for ${info.placeId}: max markets per place reached`,
      );
    } else {
      console.error(
        `  Follow-up failed for ${info.placeId}:`,
        err.message?.slice(0, 100),
      );
    }
  }
}
