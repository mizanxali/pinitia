"use client";

import Link from "next/link";
import { type MarketInfo } from "@/hooks/useMarkets";

export interface Venue {
  placeId: string;
  name: string;
  address: string;
  photoUrl?: string;
}

interface VenueCardProps {
  venue: Venue;
  markets: MarketInfo[];
}

export default function VenueCard({ venue, markets }: VenueCardProps) {
  const activeCount = markets.filter((m) => !m.resolved).length;
  const totalPool = markets.reduce(
    (sum, m) => sum + m.longPool + m.shortPool,
    0n,
  );
  const poolDisplay = (Number(totalPool) / 1e18).toFixed(2);

  return (
    <Link href={`/venue/${venue.placeId}`}>
      <div className="group cursor-pointer border-2 border-border bg-card p-5 shadow-neo transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-neo-pressed">
        <div className="mb-3 flex h-32 items-center justify-center border-2 border-border bg-main overflow-hidden">
          {venue.photoUrl ? (
            <img
              src={venue.photoUrl}
              alt={venue.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-heading text-4xl">📍</span>
          )}
        </div>
        <h3 className="font-heading text-lg font-extrabold leading-tight">
          {venue.name}
        </h3>
        <p className="mt-1 font-body text-xs text-muted-foreground line-clamp-1">
          {venue.address}
        </p>
        <div className="mt-3 flex items-center gap-2">
          {activeCount > 0 && (
            <span className="border-2 border-border bg-green-300 px-2 py-0.5 text-xs font-bold">
              {activeCount} active
            </span>
          )}
          {totalPool > 0n && (
            <span className="border-2 border-border bg-secondary px-2 py-0.5 text-xs font-bold">
              {poolDisplay} GAS
            </span>
          )}
          {markets.length === 0 && (
            <span className="border-2 border-border bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
              No markets yet
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
