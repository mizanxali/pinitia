"use client";

import { useQuery } from "@tanstack/react-query";

export interface PlaceSnapshot {
  id: number;
  place_id: string;
  rating: number;
  review_count: number;
  fetched_at: string;
}

export function useSnapshotHistory(placeId: string) {
  return useQuery({
    queryKey: ["snapshots", placeId],
    queryFn: async (): Promise<PlaceSnapshot[]> => {
      const res = await fetch(`/api/snapshots?placeId=${placeId}`);
      if (!res.ok) throw new Error("Failed to fetch snapshots");
      return res.json();
    },
    refetchInterval: 60_000,
  });
}
