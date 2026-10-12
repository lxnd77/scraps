"use server";

import { emailSchema } from "@scraps/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { CopyKey } from "@/copy/en";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type SignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; messageKey: CopyKey; fieldError?: string };

/** The origin this request came in on, behind Vercel's proxy as well as locally. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function requestMagicLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return {
      status: "error",
      messageKey: "auth.error.generic",
      fieldError: parsed.error.issues[0]?.message,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: true,
      // Supabase's built-in email (no custom SMTP, so no custom template) sends a PKCE link that
      // comes back with ?code=…; this is where that is exchanged. A customised template that
      // links straight to /auth/confirm with a token hash keeps working and ignores this.
      emailRedirectTo: `${await requestOrigin()}/auth/callback`,
    },
  });
  if (error) return { status: "error", messageKey: "auth.error.generic" };
  return { status: "sent", email: parsed.data };
}

/** Is the Google provider switched on for this Supabase project? */
async function googleEnabled(): Promise<boolean> {
  const { supabaseUrl, supabaseKey } = publicEnv();
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseKey },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}

export async function signInWithGoogle(_prev: SignInState): Promise<SignInState> {
  if (!(await googleEnabled())) return { status: "error", messageKey: "auth.error.google" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await requestOrigin()}/auth/callback` },
  });
  if (error || !data.url) return { status: "error", messageKey: "auth.error.generic" };
  redirect(data.url);
}
