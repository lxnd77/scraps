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

/**
 * The signed-in user for rendering a page, once per request. The proxy has already checked the
 * session with the auth server on this request, so this verifies the JWT's signature with
 * getClaims (locally against the project's JWKS when keys are asymmetric) instead of a third
 * auth round trip. Every read still goes through RLS with the same token. Server actions that
 * write keep requireUser.
 */
export const requireViewer = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/sign-in");
  return { supabase, user: { id: claims.sub, email: claims.email ?? "" } };
});

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
  const { supabase, user } = await requireViewer();
  // one round trip for all four; the redirects below only need the profile
  const [profile, spaces, streak, members] = await Promise.all([
    getProfile(supabase, user.id),
    listSpaces(supabase, user.id),
    getStreak(supabase),
    listMemberAvatars(supabase).catch(() => ({}) as Record<string, MemberAvatar[]>),
  ]);
  // the auth trigger creates the row, so a missing profile means something is badly wrong
  if (!profile) redirect("/sign-in?error=link");
  if (!profile.onboarded_at) redirect("/onboarding");
  // someone followed an invite link while signed out: take them back to it now they are in
  const pending = (await cookies()).get(INVITE_COOKIE)?.value;
  if (isInviteToken(pending)) redirect(`/invite/${pending}`);
  return { user, profile, spaces, streak, members };
});
