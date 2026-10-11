// purge-trash: removes trashed scraps for good (SPEC 6.10).
//   x-internal-secret + { purge: true }   the daily job: everything deleted over 30 days ago
//   user JWT + { noteIds: [...] }          "delete forever" (owner of the note's space only)
//   user JWT + { emptySpaceId }            "empty trash" for a space the caller owns
// Storage objects go first (the storage API is the only way to delete the files), then the note
// rows; assets, tag links, documents and suggestions follow by cascade. Content is never logged.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  PURGE_BATCH,
  STORAGE_REMOVE_CHUNK,
  chunk,
  parseTrashRequest,
  purgeCutoff,
  staleSignupCutoff,
} from "../_shared/trash.ts";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, content-type, apikey, x-client-info, x-internal-secret",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...cors },
  });
}

type Admin = SupabaseClient;

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Deletes the files under `media/{noteId}/` and then the note rows. Returns how many notes. */
async function removeNotes(admin: Admin, noteIds: string[]): Promise<number> {
  const paths: string[] = [];
  for (const id of noteIds) {
    const { data } = await admin.storage.from("media").list(id, { limit: 1000 });
    for (const file of data ?? []) paths.push(`${id}/${file.name}`);
  }
  for (const part of chunk(paths, STORAGE_REMOVE_CHUNK)) {
    const { error } = await admin.storage.from("media").remove(part);
    // keep the rows if the files could not go, so the next run tries again
    if (error) throw new Error("storage remove failed");
  }
  const { error } = await admin.from("notes").delete().in("id", noteIds);
  if (error) throw new Error("note delete failed");
  return noteIds.length;
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
  const request = parseTrashRequest(await req.json().catch(() => null));
  if (!request) return json(400, { error: "invalid_request" });

  const secret = Deno.env.get("INTERNAL_SECRET") ?? "";
  const internal =
    secret.length > 0 && sameSecret(req.headers.get("x-internal-secret") ?? "", secret);

  try {
    if (request.kind === "purge") {
      if (!internal) return json(403, { error: "forbidden" });
      const { data } = await admin
        .from("notes")
        .select("id")
        .not("deleted_at", "is", null)
        .lt("deleted_at", purgeCutoff(new Date()))
        .order("deleted_at")
        .limit(PURGE_BATCH);
      const ids = (data ?? []).map((n: { id: string }) => n.id);
      const removed = ids.length ? await removeNotes(admin, ids) : 0;

      // the same daily job clears sign-ups that never finished onboarding (a bare auth user)
      const { data: stale } = await admin
        .from("profiles")
        .select("id")
        .is("onboarded_at", null)
        .lt("created_at", staleSignupCutoff(new Date()))
        .limit(50);
      let accounts = 0;
      for (const row of stale ?? []) {
        const { error } = await admin.auth.admin.deleteUser((row as { id: string }).id);
        if (!error) accounts += 1;
      }
      return json(200, { removed, accounts });
    }

    // user requests: the caller proves who they are, and must own the space
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "unauthorized" });
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json(401, { error: "unauthorized" });

    const { data: owned } = await admin
      .from("space_members")
      .select("space_id")
      .eq("user_id", auth.user.id)
      .eq("role", "owner");
    const ownedSpaces = new Set((owned ?? []).map((m: { space_id: string }) => m.space_id));

    let query = admin.from("notes").select("id, space_id").not("deleted_at", "is", null);
    query =
      request.kind === "empty"
        ? query.eq("space_id", request.spaceId)
        : query.in("id", request.noteIds);
    const { data: rows } = await query.limit(1000);

    // only trashed notes in spaces the caller owns; anything else is silently left alone
    const ids = (rows ?? [])
      .filter((n: { space_id: string }) => ownedSpaces.has(n.space_id))
      .map((n: { id: string }) => n.id);
    return json(200, { removed: ids.length ? await removeNotes(admin, ids) : 0 });
  } catch {
    return json(500, { error: "internal_error" });
  }
});
