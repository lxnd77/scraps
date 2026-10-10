"use server";

import { acceptInvite } from "@scraps/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { INVITE_COOKIE, isInviteToken } from "@/lib/invite-cookie";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { status: "idle" } | { status: "error" };

export async function joinSpace(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const token = formData.get("token");
  if (typeof token !== "string" || !isInviteToken(token)) return { status: "error" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/invite/${token}/start`);

  let spaceId: string | null;
  try {
    spaceId = await acceptInvite(supabase, token);
  } catch {
    return { status: "error" };
  }
  if (!spaceId) return { status: "error" };

  (await cookies()).delete(INVITE_COOKIE);
  revalidatePath("/", "layout");
  redirect(`/s/${spaceId}`);
}
