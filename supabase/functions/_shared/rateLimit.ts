// A thin wrapper over the rate_limit_hit SQL function. It fails open: if the limiter itself is
// unreachable the request proceeds (availability beats a hard stop), and the function logs it.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function withinLimit(
  admin: SupabaseClient,
  key: string,
  limit: number,
  seconds: number,
): Promise<boolean> {
  const { data, error } = await admin.rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_seconds: seconds,
  });
  if (error) return true;
  return data !== false;
}
