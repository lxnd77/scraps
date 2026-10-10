"use server";

import { isOldEnough, onboardingSchema } from "@scraps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { CopyKey } from "@/copy/en";
import { requireUser } from "@/lib/session";

export type OnboardingState =
  | { status: "idle" }
  /** onboarding saved; the form creates the starter scraps, then goes to the board */
  | { status: "done"; spaceId: string }
  | { status: "error"; messageKey?: CopyKey; fieldErrors?: Record<string, string> };

const timezoneSchema = z.string().trim().min(1).max(64).catch("UTC");

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse({
    birthYear: formData.get("birthYear"),
    displayName: formData.get("displayName"),
    avatarSticker: formData.get("avatarSticker"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", fieldErrors };
  }

  const { supabase, user } = await requireUser();

  // under the minimum age: sign out and keep nothing beyond the bare account row
  // (the redirect lands on sign-in, where the message is shown; the cookie change from
  // signing out would otherwise re-render this page away and lose it)
  if (!isOldEnough(parsed.data.birthYear)) {
    await supabase.auth.signOut();
    redirect("/sign-in?error=underage");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, default_capture_space")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.onboarded_at) redirect("/");

  // idempotent: a double submit reuses the space the first one made
  let spaceId = profile?.default_capture_space ?? null;
  if (!spaceId) {
    const { data: space, error } = await supabase
      .from("spaces")
      .insert({ owner_id: user.id, name: "brain dump", color: "yellow" })
      .select("id")
      .single();
    if (error || !space) return { status: "error", messageKey: "error.generic" };
    spaceId = space.id;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      avatar_sticker: parsed.data.avatarSticker,
      birth_year: parsed.data.birthYear,
      timezone: timezoneSchema.parse(formData.get("timezone")),
      default_capture_space: spaceId,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (updateError) return { status: "error", messageKey: "error.generic" };

  revalidatePath("/", "layout");
  return { status: "done", spaceId };
}
