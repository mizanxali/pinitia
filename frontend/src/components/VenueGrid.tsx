"use client";

import { useActiveMarkets } from "@/hooks/useMarkets";
import { usePlaces } from "@/hooks/usePlaces";
import VenueCard from "@/components/VenueCard";

export default function VenueGrid() {
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

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-56 animate-pulse border-2 border-border bg-muted"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {venueMarkets.map(({ venue, markets: vMarkets }) => (
        <VenueCard key={venue.placeId} venue={venue} markets={vMarkets} />
      ))}
    </div>
  );
}
