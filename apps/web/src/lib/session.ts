import {
  getProfile,
  getStreak,
  listMemberAvatars,
  listSpaces,
  type MemberAvatar,
  type ProfileRow,
  type SpaceSummary,
  type Streak,
} from "@scraps/db";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { INVITE_COOKIE, isInviteToken } from "@/lib/invite-cookie";
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
  /** everyone in each of your spaces, for avatar stacks */
  members: Record<string, MemberAvatar[]>;
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
  // someone followed an invite link while signed out: take them back to it now they are in
  const pending = (await cookies()).get(INVITE_COOKIE)?.value;
  if (isInviteToken(pending)) redirect(`/invite/${pending}`);
  const [spaces, streak, members] = await Promise.all([
    listSpaces(supabase, user.id),
    getStreak(supabase),
    listMemberAvatars(supabase).catch(() => ({}) as Record<string, MemberAvatar[]>),
  ]);
  return { user: { id: user.id, email: user.email ?? "" }, profile, spaces, streak, members };
});
