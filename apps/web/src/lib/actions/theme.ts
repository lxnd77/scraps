"use server";

import { themeSchema } from "@scraps/db";
import { createClient } from "@/lib/supabase/server";

/** Persists the theme choice to the profile. Signed-out visitors keep the cookie only. */
export async function saveTheme(theme: string): Promise<void> {
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("profiles").update({ theme: parsed.data }).eq("id", data.user.id);
}
