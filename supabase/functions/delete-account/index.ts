// delete-account: removes the signed-in person and their data (SPEC 9.9).
//   user JWT + { spaces: { [spaceId]: { transfer: userId } | { delete: true } } }
// Spaces they own with nobody else in them are deleted. A shared one needs a decision, or the
// whole request is refused with 409 and nothing is touched. Then: transfers, owned spaces and
// their files, exports, and finally the auth user (the profile, memberships, capture tokens and
// suggestions cascade). Content is never logged. Safe to retry after a failure.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  parseDecisions,
  planAccountDeletion,
  type OwnedSpace,
} from "../_shared/account.ts";
import { reportError } from "../_shared/report.ts";
import { withinLimit } from "../_shared/rateLimit.ts";
import { STORAGE_REMOVE_CHUNK, chunk } from "../_shared/trash.ts";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...cors },
  });
}

type Admin = SupabaseClient;

async function removeFolder(admin: Admin, bucket: string, prefix: string): Promise<void> {
  const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  const paths = (data ?? []).map((f: { name: string }) => `${prefix}/${f.name}`);
  for (const part of chunk(paths, STORAGE_REMOVE_CHUNK)) {
    await admin.storage.from(bucket).remove(part);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method === "GET") return json(200, { status: "ok" });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "unauthorized" });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json(401, { error: "unauthorized" });
  const userId = auth.user.id;
  if (!(await withinLimit(admin, `delete-account:${userId}`, 5, 3600))) {
    return json(429, { error: "rate_limited" });
  }

  const body = (await req.json().catch(() => null)) as { spaces?: unknown } | null;
  if (!body) return json(400, { error: "invalid_request" });
  const decisions = parseDecisions(body.spaces);

  try {
    // ---- facts ----
    const { data: ownedRows } = await admin
      .from("space_members")
      .select("space_id")
      .eq("user_id", userId)
      .eq("role", "owner");
    const ownedIds = (ownedRows ?? []).map((r: { space_id: string }) => r.space_id);

    const owned: OwnedSpace[] = [];
    for (const spaceId of ownedIds) {
      const { data: members } = await admin
        .from("space_members")
        .select("user_id, role")
        .eq("space_id", spaceId)
        .neq("user_id", userId);
      owned.push({
        spaceId,
        others: (members ?? []).map((m: { user_id: string; role: string }) => ({
          userId: m.user_id,
          role: m.role as "owner" | "editor" | "viewer",
        })),
      });
    }

    // ---- plan: nothing is touched unless every shared space has a valid answer ----
    const plan = planAccountDeletion(owned, decisions);
    if (!plan.ok) {
      return json(409, { error: "decision_required", missing: plan.missing, invalid: plan.invalid });
    }

    // ---- do it ----
    for (const action of plan.actions) {
      if (action.kind === "transfer") {
        const { error } = await admin.rpc("account_transfer_space", {
          p_from: userId,
          p_space: action.spaceId,
          p_to: action.to,
        });
        if (error) return json(409, { error: "transfer_failed", spaceId: action.spaceId });
      }
    }
    for (const action of plan.actions) {
      if (action.kind !== "delete") continue;
      const { data: notes } = await admin
        .from("notes")
        .select("id")
        .eq("space_id", action.spaceId);
      for (const note of notes ?? []) await removeFolder(admin, "media", (note as { id: string }).id);
      const { error } = await admin.from("spaces").delete().eq("id", action.spaceId);
      if (error) return json(500, { error: "internal_error" });
    }
    // exports built for this person live under their id (bucket may not exist yet)
    await removeFolder(admin, "exports", userId).catch(() => undefined);

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) return json(500, { error: "internal_error" });
    return json(200, { ok: true });
  } catch (error) {
    await reportError(Deno.env.get("SENTRY_DSN"), "delete-account", "request", error);
    return json(500, { error: "internal_error" });
  }
});
