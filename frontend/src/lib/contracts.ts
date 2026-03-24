export const MARKET_FACTORY_ADDRESS =
  (process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS as `0x${string}`) ??
  "0x9EabdE24897cf45c3Df84b62d099D0aeA4dB4687";

export const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ?? "pinitia-1";

export const MINITIA_RPC_URL =
  process.env.NEXT_PUBLIC_MINITIA_RPC_URL ?? "http://localhost:8545";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://xfsdxweuomaohfkahhai.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
