import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import type { CaptureTokenRow } from "./capture-actions";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = { title: "scraps. settings" };

export default async function SettingsPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("capture_tokens")
    .select("id, label, created_at, last_used_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const tokens: CaptureTokenRow[] = (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));

  return (
    <SettingsView
      captureTokens={tokens}
      shortcutUrl={process.env.NEXT_PUBLIC_SHORTCUT_URL ?? null}
      captureEndpoint={`${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/functions/v1/capture`}
    />
  );
}
