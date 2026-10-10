import {
  getProfile,
  getStreak,
  listSpaces,
  type ProfileRow,
  type SpaceSummary,
  type Streak,
} from "@scraps/db";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Verified user or a redirect to sign-in. Always validates the token with the auth server. */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");
  return { supabase, user: data.user as User };
}

export interface ShellData {
  user: { id: string; email: string };
  profile: ProfileRow;
  spaces: SpaceSummary[];
  streak: Streak;
}

/**
 * Everything the app shell and pages need, loaded once per request.
 * Signed-in users who have not finished onboarding are sent there.
 */
export const loadShellData = cache(async (): Promise<ShellData> => {
  const { supabase, user } = await requireUser();
  const profile = await getProfile(supabase, user.id);
  // the auth trigger creates the row, so a missing profile means something is badly wrong
  if (!profile) redirect("/sign-in?error=link");
  if (!profile.onboarded_at) redirect("/onboarding");
  const [spaces, streak] = await Promise.all([listSpaces(supabase, user.id), getStreak(supabase)]);
  return { user: { id: user.id, email: user.email ?? "" }, profile, spaces, streak };
});
