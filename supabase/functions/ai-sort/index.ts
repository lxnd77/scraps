// ai-sort: "file under…" suggestions for one scrap (SPEC 9.5). Signed-in users send { noteId }.
// Server-side it checks profiles.ai_enabled (no model call when off), the 60 per hour limit and
// that the person can write to the note, then asks Claude with the fields listed in SPEC 9.5 only.
// Bad model output is never an error: the answer is just { suggestion: null }. Note content is
// never logged.
import { createClient } from "@supabase/supabase-js";
import { checkClaudeKey, runAiSort } from "../_shared/aiSortService.ts";
import { supabaseSortStore } from "../_shared/aiSortStore.ts";

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

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  // `configured` says only whether a key is present, for `pnpm ai:check`. With ?verify=1 and the
  // internal secret it also asks Anthropic whether the key is real and can use the model (a free
  // metadata call, no tokens): the one-shot answer to "why does Claude never see our requests?"
  if (req.method === "GET") {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    const verify = new URL(req.url).searchParams.get("verify") === "1";
    if (!verify) return json(200, { status: "ok", configured: Boolean(key) });
    const secret = Deno.env.get("INTERNAL_SECRET") ?? "";
    if (!secret || !sameSecret(req.headers.get("x-internal-secret") ?? "", secret)) {
      return json(403, { error: "forbidden" });
    }
    return json(200, { status: "ok", configured: Boolean(key), ...(await checkClaudeKey(key)) });
  }
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "unauthorized" });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json(401, { error: "unauthorized" });

  const body = (await req.json().catch(() => null)) as { noteId?: unknown } | null;
  if (typeof body?.noteId !== "string" || !UUID.test(body.noteId)) {
    return json(400, { error: "invalid_request" });
  }

  const result = await runAiSort(supabaseSortStore(admin), auth.user.id, body.noteId, {
    apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
  });

  switch (result.status) {
    case "ok":
      if (result.suggestion) return json(200, { suggestion: result.suggestion });
      // the reason is a fixed code plus a vendor status, never note content
      if (result.reason === "model_error")
        console.warn("ai-sort: model call failed", result.detail);
      return json(200, { suggestion: null, reason: result.reason, detail: result.detail });
    case "unconfigured":
      console.warn("ai-sort: ANTHROPIC_API_KEY is not set");
      return json(503, { error: "ai_unconfigured" });
    case "disabled":
      return json(403, { error: "ai_disabled" });
    case "rate_limited":
      return json(429, { error: "rate_limited" });
    case "forbidden":
      return json(403, { error: "forbidden" });
    default:
      return json(404, { error: "not_found" });
  }
});
