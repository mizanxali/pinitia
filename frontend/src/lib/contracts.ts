export const MARKET_FACTORY_ADDRESS =
  (process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS as `0x${string}`) ??
  "0x797764f4cab7a0798D569A4537736D9e1a3F3787";

export const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ?? "pinitia-1";

export const MINITIA_RPC_URL =
  process.env.NEXT_PUBLIC_MINITIA_RPC_URL ?? "http://localhost:8545";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://xfsdxweuomaohfkahhai.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
