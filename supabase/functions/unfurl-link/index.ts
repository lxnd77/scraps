// unfurl-link: signed-in users send a URL, we fetch it through the SSRF guard, parse Open Graph
// (plus YouTube oEmbed and map pins) and cache the result in link_previews for 7 days.
// The pipeline lives in ../_shared/unfurlService.ts so `capture` can use it too.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { BlockedUrlError } from "../_shared/ssrf.ts";
import { unfurlUrl } from "../_shared/unfurlService.ts";

const body = z.object({ url: z.string().min(1).max(2048) });

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  // a health probe for local tooling; it reveals nothing
  if (req.method === "GET") return json(200, { status: "ok" });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "unauthorized" });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json(401, { error: "unauthorized" });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid_request" });

  try {
    return json(200, await unfurlUrl(admin, parsed.data.url));
  } catch (error) {
    if (error instanceof BlockedUrlError) return json(422, { error: error.reason });
    return json(400, { error: "invalid_url" });
  }
});
