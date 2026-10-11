// transcribe-audio: turns a voice memo into text (SPEC 9.4).
//   * the `assets_transcribe_hook` database trigger posts { assetId } with x-internal-secret
//   * a signed-in editor posts { assetId } to retry a failed memo
//   * x-internal-secret + { backfill: true } queues audio that never got a transcript
// The provider comes from TRANSCRIPTION_PROVIDER (groq, openai or fake). The audio and the
// transcript are never logged. Only this function writes assets.transcript (a trigger refuses
// everyone else).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { withinLimit } from "../_shared/rateLimit.ts";
import { TranscriptionError, createProvider, withRetry } from "../_shared/transcription.ts";

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Admin = SupabaseClient;

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Transcribes one asset and records the outcome. Never throws. */
async function transcribe(admin: Admin, assetId: string): Promise<"done" | "failed" | "skipped"> {
  const { data: asset } = await admin
    .from("assets")
    .select("id, kind, storage_path, mime, transcript_status")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset || asset.kind !== "audio") return "skipped";
  if (asset.transcript_status === "done") return "done";

  await admin.from("assets").update({ transcript_status: "pending" }).eq("id", assetId);

  const provider = createProvider({
    provider: Deno.env.get("TRANSCRIPTION_PROVIDER"),
    apiKey: Deno.env.get("TRANSCRIPTION_API_KEY"),
  });
  if (!provider) {
    await admin.from("assets").update({ transcript_status: "failed" }).eq("id", assetId);
    return "failed";
  }

  try {
    // the object may land a moment after the row (the outbox uploads in order), so a missing
    // file is retried with the same backoff as a vendor hiccup
    const text = await withRetry(
      async () => {
        const { data: blob, error } = await admin.storage
          .from("media")
          .download(asset.storage_path as string);
        if (error || !blob) throw new TranscriptionError("audio not available yet", true);
        const mime = (asset.mime as string) || blob.type || "audio/webm";
        return (await provider.transcribe(blob, mime)).text;
      },
      { retries: 2, baseMs: 2000 },
    );
    await admin
      .from("assets")
      .update({ transcript: text, transcript_status: "done" })
      .eq("id", assetId);
    return "done";
  } catch {
    await admin.from("assets").update({ transcript_status: "failed" }).eq("id", assetId);
    return "failed";
  }
}

function background(work: Promise<unknown>): void {
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else void work;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method === "GET") return json(200, { status: "ok" });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const body = (await req.json().catch(() => null)) as {
    assetId?: unknown;
    backfill?: unknown;
  } | null;
  if (!body) return json(400, { error: "invalid_request" });

  // ---- who is calling ----
  const secret = Deno.env.get("INTERNAL_SECRET") ?? "";
  const sent = req.headers.get("x-internal-secret") ?? "";
  const internal = secret.length > 0 && sameSecret(sent, secret);
  let userId: string | null = null;
  if (!internal) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "unauthorized" });
    const { data: auth, error } = await admin.auth.getUser(token);
    if (error || !auth.user) return json(401, { error: "unauthorized" });
    userId = auth.user.id;
    if (!(await withinLimit(admin, `transcribe:${userId}`, 20, 3600))) {
      return json(429, { error: "rate_limited" });
    }
  }

  // ---- backfill ----
  if (body.backfill === true) {
    if (!internal) return json(403, { error: "forbidden" });
    const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
    const { data: rows } = await admin
      .from("assets")
      .select("id")
      .eq("kind", "audio")
      .in("transcript_status", ["none", "pending"])
      .lt("created_at", cutoff)
      .order("created_at")
      .limit(50);
    const ids = (rows ?? []).map((r: { id: string }) => r.id);
    background(
      (async () => {
        for (const id of ids) await transcribe(admin, id);
      })(),
    );
    return json(202, { queued: ids.length });
  }

  // ---- one asset ----
  if (typeof body.assetId !== "string" || !UUID.test(body.assetId)) {
    return json(400, { error: "invalid_request" });
  }
  const assetId = body.assetId;

  if (userId) {
    const { data: asset } = await admin
      .from("assets")
      .select("space_id")
      .eq("id", assetId)
      .maybeSingle();
    if (!asset) return json(404, { error: "not_found" });
    const { data: member } = await admin
      .from("space_members")
      .select("role")
      .eq("space_id", asset.space_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member || (member.role !== "owner" && member.role !== "editor")) {
      return json(404, { error: "not_found" });
    }
    return json(200, { status: await transcribe(admin, assetId) });
  }

  // the database hook does not wait for the answer
  background(transcribe(admin, assetId));
  return json(202, { status: "queued" });
});
