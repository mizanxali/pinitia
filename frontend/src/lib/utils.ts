import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length < chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatMin(umin: bigint): string {
  const min = Number(umin) / 1e6;
  if (min >= 1) return min.toFixed(2);
  if (min >= 0.01) return min.toFixed(4);
  return min.toFixed(6);
}

/** @deprecated Use formatMin instead */
export const formatGas = formatMin;

export function formatRating(scaled: bigint | number): string {
  return (Number(scaled) / 100).toFixed(1);
}

export function getCountdown(resolveDate: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = resolveDate - now;
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function getMarketStatus(
  resolved: boolean,
  resolveDate: number,
): "active" | "pending" | "resolved" {
  if (resolved) return "resolved";
  const now = Math.floor(Date.now() / 1000);
  if (now >= resolveDate) return "pending";
  return "active";
}
