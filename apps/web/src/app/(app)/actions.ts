"use server";

import {
  createSpaceSchema,
  profileUpdateSchema,
  updateSpaceSchema,
  type SpaceColor,
} from "@scraps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CopyKey } from "@/copy/en";
import { requireUser } from "@/lib/session";

export type FormState =
  | { status: "idle" }
  | { status: "ok"; spaceId?: string }
  | { status: "error"; messageKey?: CopyKey; fieldErrors?: Record<string, string> };

function fieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function createSpace(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createSpaceSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("spaces")
    .insert({ owner_id: user.id, name: parsed.data.name, color: parsed.data.color })
    .select("id")
    .single();
  if (error || !data) return { status: "error", messageKey: "error.generic" };

  revalidatePath("/", "layout");
  return { status: "ok", spaceId: data.id };
}

export async function updateSpace(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = updateSpaceSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("spaces")
    .update({ name: parsed.data.name, color: parsed.data.color as SpaceColor })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return { status: "error", messageKey: "error.generic" };
  // RLS filters the update to nothing when the caller is not the owner
  if (!data || data.length === 0) return { status: "error", messageKey: "space.notice.owner_only" };

  revalidatePath("/", "layout");
  return { status: "ok", spaceId: parsed.data.id };
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileUpdateSchema.safeParse({
    displayName: formData.get("displayName"),
    avatarSticker: formData.get("avatarSticker"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error.issues) };

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName, avatar_sticker: parsed.data.avatarSticker })
    .eq("id", user.id);
  if (error) return { status: "error", messageKey: "error.generic" };

  revalidatePath("/", "layout");
  return { status: "ok" };
}

export async function setTidyMode(enabled: boolean): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase
    .from("profiles")
    .update({ tidy_mode: Boolean(enabled) })
    .eq("id", user.id);
  revalidatePath("/", "layout");
}

export async function signOut(): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
