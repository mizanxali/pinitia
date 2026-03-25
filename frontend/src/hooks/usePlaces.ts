"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

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
      const { data, error } = await supabase
        .from("places")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePlace(placeId: string) {
  return useQuery({
    queryKey: ["places", placeId],
    queryFn: async (): Promise<Place | null> => {
      const { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("place_id", placeId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data ?? null;
    },
  });
}
