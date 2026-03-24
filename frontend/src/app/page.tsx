"use client";

import { useActiveMarkets } from "@/hooks/useMarkets";
import { usePlaces } from "@/hooks/usePlaces";
import VenueCard from "@/components/VenueCard";

export default function HomePage() {
  const { data: markets, isLoading: marketsLoading } = useActiveMarkets();
  const { data: places, isLoading: placesLoading } = usePlaces();

  const isLoading = marketsLoading || placesLoading;

  const venueMarkets = (places ?? []).map((place) => ({
    venue: {
      placeId: place.place_id,
      name: place.name,
      address: place.address ?? "",
      photoUrl: place.photo_url ?? undefined,
    },
    markets: (markets ?? []).filter((m) => m.placeId === place.place_id),
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-4xl font-extrabold">
          Prediction Markets on Places
        </h1>
        <p className="mt-2 font-body text-lg text-muted-foreground">
          Bet LONG or SHORT on Google Maps venue metrics. Winners split the
          losers&apos; pool.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse border-2 border-border bg-muted"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venueMarkets.map(({ venue, markets: vMarkets }) => (
            <VenueCard key={venue.placeId} venue={venue} markets={vMarkets} />
          ))}
        </div>
      )}
    </div>
  );
}
