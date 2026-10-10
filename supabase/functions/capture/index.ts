// capture: the Apple Shortcut "Send to Scraps" posts here with a capture token (SPEC 9.6).
//   Authorization: Bearer scr_<64 hex>
//   JSON      { url?, text?, title? }
//   multipart fields url, text, title and one image file (JPEG or PNG; EXIF is stripped)
// The note is created through the collab server (internal secret, acting for the token's owner) in
// the owner's default capture space. Returns { noteId, url }. Note content is never logged.
import { createClient } from "@supabase/supabase-js";
import {
  MAX_IMAGE_BYTES,
  bearerToken,
  hashToken,
  parseCaptureInput,
  planNote,
  uuidv7,
  type CaptureInput,
} from "../_shared/capture.ts";
import { cleanImage, imageSize } from "../_shared/jpeg.ts";
import { BlockedUrlError } from "../_shared/ssrf.ts";
import { unfurlUrl } from "../_shared/unfurlService.ts";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(status: number, payload: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...cors,
      ...headers,
    },
  });
}

/**
 * Phase 8 hook: called once a scrap exists so AI suggestions can be queued for it. A no-op until
 * the `ai-sort` function lands (PLAN phase 8); callers do not wait for it.
 */
// deno-lint-ignore no-unused-vars
function afterCapture(_args: { noteId: string; spaceId: string; userId: string }): void {}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method === "GET") return json(200, { status: "ok" });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const token = bearerToken(req.headers.get("authorization"));
  if (!token) return json(401, { error: "unauthorized" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const collabUrl = Deno.env.get("COLLAB_INTERNAL_URL") ?? "http://host.docker.internal:1234";
  const internalSecret = Deno.env.get("INTERNAL_SECRET");
  const appUrl = (Deno.env.get("APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  if (!internalSecret) return json(500, { error: "not_configured" });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // the cheap rejects come before reading a body: an oversized upload from anyone is refused
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES + 64 * 1024) return json(413, { error: "too_large" });

  const { data: rows, error: tokenError } = await admin.rpc("use_capture_token", {
    p_hash: await hashToken(token),
  });
  if (tokenError) return json(500, { error: "internal_error" });
  const result = (
    rows as Array<{ status: string; user_id: string | null; space_id: string | null }>
  )[0];
  if (!result || result.status === "invalid") return json(401, { error: "unauthorized" });
  if (result.status === "rate_limited") {
    return json(429, { error: "rate_limited" }, { "retry-after": "60" });
  }
  if (!result.user_id || !result.space_id) return json(409, { error: "no_space" });
  const userId = result.user_id;
  const spaceId = result.space_id;

  // ---- body ----
  let input: CaptureInput;
  let image: File | null = null;
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = [...form.values()].find((v): v is File => typeof v !== "string");
      image = file && file.size > 0 ? file : null;
      const parsed = parseCaptureInput(
        {
          url: form.get("url") ?? undefined,
          text: form.get("text") ?? undefined,
          title: form.get("title") ?? undefined,
        },
        { allowEmpty: image !== null },
      );
      if (!parsed.ok) return json(400, { error: parsed.error });
      input = parsed.value;
    } else {
      const parsed = parseCaptureInput(await req.json().catch(() => null));
      if (!parsed.ok) return json(400, { error: parsed.error });
      input = parsed.value;
    }
  } catch {
    return json(400, { error: "invalid_request" });
  }

  // ---- image ----
  let cleaned: ReturnType<typeof cleanImage> = null;
  if (image) {
    if (image.size > MAX_IMAGE_BYTES) return json(413, { error: "too_large" });
    try {
      cleaned = cleanImage(new Uint8Array(await image.arrayBuffer()));
    } catch {
      return json(415, { error: "unsupported_type" });
    }
    // v1 stores JPEG and PNG as sent; the shortcut converts HEIC to JPEG first (DECISIONS)
    if (!cleaned) return json(415, { error: "unsupported_type" });
  }

  const plan = planNote(input, cleaned !== null);
  const noteId = uuidv7();
  const media: Record<string, unknown> = {};
  let assetId: string | null = null;
  let storagePath: string | null = null;

  if (plan.start === "link" && plan.url) {
    try {
      const p = await unfurlUrl(admin, plan.url);
      Object.assign(media, {
        url: p.url,
        title: p.title ?? undefined,
        description: p.description ?? undefined,
        image: p.image ?? undefined,
        domain: p.domain ?? undefined,
        duration: p.duration ?? undefined,
        mediaType: p.mediaType === "video" || p.mediaType === "maps" ? p.mediaType : "article",
      });
    } catch (error) {
      if (error instanceof BlockedUrlError) return json(422, { error: error.reason });
      media.url = plan.url; // an unfurl that failed still keeps the link
    }
  }

  if (cleaned) {
    assetId = uuidv7();
    storagePath = `${noteId}/${assetId}.${cleaned.ext}`;
    const size = imageSize(cleaned.bytes);
    Object.assign(media, {
      assetId,
      path: storagePath,
      ...(size ? { width: size.width, height: size.height } : {}),
    });
  }

  // ---- create the note through the collab server ----
  const created = await fetch(`${collabUrl.replace(/\/$/, "")}/notes`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": internalSecret },
    body: JSON.stringify({
      id: noteId,
      spaceId,
      userId,
      start: plan.start,
      title: plan.title,
      text: plan.start === "text" ? plan.text : undefined,
      media: Object.keys(media).length > 0 ? media : undefined,
    }),
  }).catch(() => null);
  if (!created || (created.status !== 201 && created.status !== 200)) {
    return json(502, { error: "collab_unavailable" });
  }

  // ---- upload the picture; a scrap that cannot get its picture is removed again ----
  if (cleaned && assetId && storagePath) {
    const size = imageSize(cleaned.bytes);
    const uploaded = await admin.storage
      .from("media")
      .upload(storagePath, cleaned.bytes, { contentType: cleaned.mime, upsert: false });
    let ok = !uploaded.error;
    if (ok) {
      const { error } = await admin.from("assets").insert({
        id: assetId,
        note_id: noteId,
        space_id: spaceId,
        uploader_id: userId,
        kind: "image",
        storage_path: storagePath,
        mime: cleaned.mime,
        bytes: cleaned.bytes.length,
        width: size?.width ?? null,
        height: size?.height ?? null,
      });
      ok = !error;
    }
    if (!ok) {
      await admin.storage.from("media").remove([storagePath]);
      await admin
        .from("notes")
        .update({ deleted_at: new Date().toISOString(), meta_updated_at: new Date().toISOString() })
        .eq("id", noteId);
      return json(502, { error: "upload_failed" });
    }
  }

  afterCapture({ noteId, spaceId, userId });
  return json(201, { noteId, url: `${appUrl}/n/${noteId}` });
});
