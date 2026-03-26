export const MARKET_FACTORY_ADDRESS =
  (process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS as `0x${string}`) ??
  "0x231E3F6799cc3dEaD374d29844C237802031bEc0";

export const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ?? "pinitia-1";

export const MINITIA_RPC_URL =
  process.env.NEXT_PUBLIC_MINITIA_RPC_URL ?? "http://localhost:8545";
