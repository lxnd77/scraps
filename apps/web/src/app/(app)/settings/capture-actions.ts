"use server";

import { z } from "zod";
import { requireUser } from "@/lib/session";

export interface CaptureTokenRow {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export type CreateTokenResult =
  | { status: "ok"; token: string; row: CaptureTokenRow }
  | { status: "error"; reason: "invalid" | "limit" | "failed" };

const labelSchema = z.string().trim().max(40);

/**
 * Mints a capture token through `create_capture_token`, which returns the plaintext once and
 * stores only its SHA-256 (SPEC 12). The value goes straight back to the caller and is never
 * logged or kept on the server.
 */
export async function createCaptureToken(label: string): Promise<CreateTokenResult> {
  const parsed = labelSchema.safeParse(label);
  if (!parsed.success) return { status: "error", reason: "invalid" };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_capture_token", { p_label: parsed.data });
  if (error || !data) {
    // 54000 is the "too many live tokens" limit raised by the function
    return { status: "error", reason: error?.code === "54000" ? "limit" : "failed" };
  }

  const { data: row } = await supabase
    .from("capture_tokens")
    .select("id, label, created_at, last_used_at")
    .eq("label", parsed.data)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    status: "ok",
    token: data,
    row: {
      id: row?.id ?? "",
      label: row?.label ?? parsed.data,
      createdAt: row?.created_at ?? new Date().toISOString(),
      lastUsedAt: row?.last_used_at ?? null,
    },
  };
}

/** Revokes one of your tokens. RLS limits the update to rows you own. */
export async function revokeCaptureToken(id: string): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(id).success) return { ok: false };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("capture_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id");
  return { ok: !error && (data?.length ?? 0) > 0 };
}
