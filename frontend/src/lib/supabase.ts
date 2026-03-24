import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./contracts";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface PlaceSnapshot {
  id: number;
  place_id: string;
  rating: number;
  review_count: number;
  fetched_at: string;
}
