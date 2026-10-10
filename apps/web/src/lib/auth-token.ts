import { createClient } from "@/lib/supabase/client";

/** A fresh access token for calls straight to the collab server. */
export async function accessToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not signed in");
  return token;
}
