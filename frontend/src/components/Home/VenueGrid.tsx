"use client";

import { useMemo, useState } from "react";
import { useActiveMarkets } from "@/hooks/useMarkets";
import { usePlaces } from "@/hooks/usePlaces";
import VenueCard from "@/components/Home/VenueCard";

const CITY_COLORS = ["bg-amber-300", "bg-emerald-300", "bg-blue-300"];

const CATEGORY_COLORS = [
  "bg-rose-300",
  "bg-violet-300",
  "bg-teal-300",
  "bg-orange-300",
  "bg-pink-300",
  "bg-cyan-300",
];

const ALL_FILTER = "__ALL__";

export default function VenueGrid() {
  const { data: markets, isLoading: marketsLoading } = useActiveMarkets();
  const { data: places, isLoading: placesLoading } = usePlaces();

  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const isLoading = marketsLoading || placesLoading;

  const categories = useMemo(() => {
    if (!places) return [];
    const unique = [...new Set(places.map((p) => p.category).filter(Boolean))];
    return unique.sort();
  }, [places]);

  const cities = useMemo(() => {
    if (!places) return [];
    const unique = [...new Set(places.map((p) => p.city).filter(Boolean))];
    return unique.sort();
  }, [places]);

  const filteredPlaces = useMemo(() => {
    return (places ?? []).filter((place) => {
      if (selectedCity && place.city !== selectedCity) return false;
      if (selectedCategory && place.category !== selectedCategory) return false;
      return true;
    });
  }, [places, selectedCity, selectedCategory]);

  const venueMarkets = filteredPlaces.map((place) => ({
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
    <div>
      {/* City filter */}
      <div className="mb-3 flex flex-wrap gap-2">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: i want it to be interactive */}
        <div
          onClick={() => setSelectedCity(null)}
          onMouseEnter={() => setHoveredCity(ALL_FILTER)}
          onMouseLeave={() => setHoveredCity(null)}
          className={`cursor-pointer border-2 border-black px-3 py-1 font-heading text-sm font-bold transition-colors ${
            selectedCity === null || hoveredCity === ALL_FILTER
              ? "bg-main text-main-foreground"
              : "text-main-foreground"
          }`}
        >
          All
        </div>
        {cities.map((city, i) => {
          const cityColor = CITY_COLORS[i % CITY_COLORS.length];
          const isActive = selectedCity === city || hoveredCity === city;

          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: i want it to be interactive
            <div
              key={city}
              onClick={() => setSelectedCity(city)}
              onMouseEnter={() => setHoveredCity(city)}
              onMouseLeave={() => setHoveredCity(null)}
              className={`cursor-pointer border-2 border-black px-3 py-1 font-heading text-sm font-bold transition-colors ${
                isActive ? cityColor : "text-main-foreground"
              }`}
            >
              {city}
            </div>
          );
        })}
      </div>

      {/* Category filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: i want it to be interactive */}
        <div
          onClick={() => setSelectedCategory(null)}
          onMouseEnter={() => setHoveredCategory(ALL_FILTER)}
          onMouseLeave={() => setHoveredCategory(null)}
          className={`cursor-pointer border-2 border-black px-3 py-1 font-heading text-sm font-bold transition-colors ${
            selectedCategory === null || hoveredCategory === ALL_FILTER
              ? "bg-main text-main-foreground"
              : "text-main-foreground"
          }`}
        >
          All
        </div>
        {categories.map((category, i) => {
          const categoryColor = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
          const isActive =
            selectedCategory === category || hoveredCategory === category;

          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: i want it to be interactive
            <div
              key={category}
              onClick={() => setSelectedCategory(category)}
              onMouseEnter={() => setHoveredCategory(category)}
              onMouseLeave={() => setHoveredCategory(null)}
              className={`cursor-pointer border-2 border-black px-3 py-1 font-heading text-sm font-bold transition-colors ${
                isActive ? categoryColor : "text-main-foreground"
              }`}
            >
              {category}
            </div>
          );
        })}
      </div>

      {/* Venue grid */}
      {venueMarkets.length === 0 ? (
        <div className="border-2 border-border bg-card p-8 text-center shadow-neo">
          <p className="font-heading text-lg font-bold">No places found</p>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Try a different filter combination.
          </p>
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
