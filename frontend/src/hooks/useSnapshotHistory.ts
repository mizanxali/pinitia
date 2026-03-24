"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase, type PlaceSnapshot } from "@/lib/supabase";

export function useSnapshotHistory(placeId: string) {
  return useQuery({
    queryKey: ["snapshots", placeId],
    queryFn: async (): Promise<PlaceSnapshot[]> => {
      const { data, error } = await supabase
        .from("place_snapshots")
        .select("*")
        .eq("place_id", placeId)
        .order("fetched_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });
}
