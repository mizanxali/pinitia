"use client";

import { useQuery } from "@tanstack/react-query";

export interface Place {
  place_id: string;
  name: string;
  address: string | null;
  photo_url: string | null;
  city: string;
  category: string;
}

export function usePlaces() {
  return useQuery({
    queryKey: ["places"],
    queryFn: async (): Promise<Place[]> => {
      const res = await fetch("/api/places");
      if (!res.ok) throw new Error("Failed to fetch places");
      return res.json();
    },
  });
}

export function usePlace(placeId: string) {
  return useQuery({
    queryKey: ["places", placeId],
    queryFn: async (): Promise<Place | null> => {
      const res = await fetch(`/api/places?placeId=${placeId}`);
      if (!res.ok) throw new Error("Failed to fetch place");
      return res.json();
    },
  });
}
