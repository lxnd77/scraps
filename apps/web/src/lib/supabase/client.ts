import type { Database } from "@scraps/db";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/** Supabase client for client components. Subject to RLS like any other signed-in request. */
export function createClient() {
  const { supabaseUrl, supabaseKey } = publicEnv();
  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
