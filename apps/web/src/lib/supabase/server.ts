import type { Database } from "@scraps/db";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/** Supabase client for server components, route handlers and server actions. */
export async function createClient() {
  const store = await cookies();
  const { supabaseUrl, supabaseKey } = publicEnv();
  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // called from a server component: the proxy already refreshed the session cookies
        }
      },
    },
  });
}
