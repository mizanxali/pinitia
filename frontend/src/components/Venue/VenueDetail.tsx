"use client";

import { usePlaceMarkets } from "@/hooks/useMarkets";
import { useSnapshotHistory } from "@/hooks/useSnapshotHistory";
import { usePlace } from "@/hooks/usePlaces";
import MarketCard from "@/components/Venue/MarketCard";
import SnapshotChart from "@/components/Market/SnapshotChart";
import Link from "next/link";

export default function VenueDetail({ placeId }: { placeId: string }) {
  const decodedPlaceId = decodeURIComponent(placeId);
  const { data: markets, isLoading: marketsLoading } =
    usePlaceMarkets(decodedPlaceId);
  const { data: snapshots } = useSnapshotHistory(decodedPlaceId);
  const { data: place } = usePlace(decodedPlaceId);

  const latestSnapshot = snapshots?.at(-1);
  const activeMarkets = markets?.filter((m) => !m.resolved) ?? [];
  const resolvedMarkets = markets?.filter((m) => m.resolved) ?? [];

  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-block font-body text-sm font-bold text-muted-foreground hover:underline"
      >
        &larr; Back to places
      </Link>

      <div className="mb-6 border-2 border-border bg-card p-6 shadow-neo">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center border-2 border-border bg-main overflow-hidden">
            {place?.photo_url ? (
              <img
                src={place.photo_url}
                alt={place.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl">📍</span>
            )}
          </div>
          <div>
            <h1 className="font-heading text-3xl font-extrabold">
              {place?.name ?? decodedPlaceId}
            </h1>
            {place?.address && (
              <p className="mt-1 font-body text-sm text-muted-foreground">
                {place.address}
              </p>
            )}
            {latestSnapshot && (
              <div className="mt-2 flex gap-3">
                <span className="border-2 border-border bg-secondary px-2 py-0.5 text-xs font-bold">
                  Rating: {latestSnapshot.rating}
                </span>
                <span className="border-2 border-border bg-secondary px-2 py-0.5 text-xs font-bold">
                  Reviews: {latestSnapshot.review_count}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-heading text-xl font-extrabold">
              Rating History
            </h2>
            <SnapshotChart snapshots={snapshots ?? []} metric="rating" />
          </div>
          <div>
            <h2 className="mb-3 font-heading text-xl font-extrabold">
              Review Count History
            </h2>
            <SnapshotChart snapshots={snapshots ?? []} metric="review_count" />
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-heading text-xl font-extrabold">
            Active Markets
          </h2>
          {marketsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse border-2 border-border bg-muted"
                />
              ))}
            </div>
          ) : activeMarkets.length === 0 ? (
            <div className="border-2 border-border bg-muted p-6 text-center font-body text-sm font-bold text-muted-foreground">
              No active markets for this place
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {activeMarkets.map((m) => (
                <MarketCard key={m.address} market={m} />
              ))}
            </div>
          )}

          <h2 className="mb-3 mt-6 font-heading text-xl font-extrabold">
            Resolved Markets
          </h2>
          {marketsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse border-2 border-border bg-muted"
                />
              ))}
            </div>
          ) : resolvedMarkets.length === 0 ? (
            <div className="border-2 border-border bg-muted p-6 text-center font-body text-sm font-bold text-muted-foreground">
              No resolved markets for this place yet
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {resolvedMarkets.map((m) => (
                <MarketCard key={m.address} market={m} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
