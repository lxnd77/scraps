// unfurl-link: signed-in users send a URL, we fetch it through the SSRF guard, parse Open Graph
// (plus YouTube oEmbed and map pins) and cache the result in link_previews for 7 days.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { BlockedUrlError, parsePublicUrl, safeFetch, type Resolver } from "../_shared/ssrf.ts";
import {
  detectMediaType,
  isYouTube,
  parseHtmlPreview,
  parseMapPin,
  type MediaType,
} from "../_shared/unfurl.ts";

const FRESH_MS = 7 * 24 * 60 * 60 * 1000;
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

const resolve: Resolver = async (hostname) => {
  const [a, aaaa] = await Promise.allSettled([
    Deno.resolveDns(hostname, "A"),
    Deno.resolveDns(hostname, "AAAA"),
  ]);
  return [
    ...(a.status === "fulfilled" ? a.value : []),
    ...(aaaa.status === "fulfilled" ? aaaa.value : []),
  ];
};

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Same page, same hash: drop the fragment and lowercase scheme and host (URL does both). */
function normalise(raw: string): string {
  const url = parsePublicUrl(raw);
  url.hash = "";
  return url.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
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

  let url: string;
  try {
    url = normalise(parsed.data.url);
  } catch (error) {
    if (error instanceof BlockedUrlError) return json(422, { error: error.reason });
    return json(400, { error: "invalid_url" });
  }

  const hash = await sha256Hex(url);
  const { data: cached } = await admin
    .from("link_previews")
    .select("*")
    .eq("url_hash", hash)
    .maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < FRESH_MS) {
    return json(200, toResponse(cached));
  }

  const mediaType: MediaType = detectMediaType(url);
  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname.replace(/^www\./, "");
  let preview = { title: null as string | null, description: null as string | null, imageUrl: null as string | null, siteName: null as string | null, durationS: null as number | null };

  try {
    const page = await safeFetch(url, {
      resolve,
      headers: { "user-agent": "ScrapsLinkPreview/1.0", accept: "text/html,*/*;q=0.5" },
    });
    const type = page.headers.get("content-type") ?? "";
    if (page.status < 400 && /html|xml/i.test(type)) {
      preview = parseHtmlPreview(new TextDecoder().decode(page.body), page.url);
    }
  } catch (error) {
    if (error instanceof BlockedUrlError) return json(422, { error: error.reason });
    // an unreachable site still gets a plain domain card below
  }

  if (isYouTube(parsedUrl) && (!preview.title || !preview.imageUrl)) {
    try {
      const oembed = await safeFetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
        { resolve, maxBytes: 64 * 1024 },
      );
      if (oembed.status === 200) {
        const data = JSON.parse(new TextDecoder().decode(oembed.body)) as {
          title?: string;
          thumbnail_url?: string;
          author_name?: string;
        };
        preview.title ??= data.title ?? null;
        preview.imageUrl ??= data.thumbnail_url ?? null;
        preview.siteName ??= data.author_name ?? "youtube";
      }
    } catch {
      // oEmbed is a bonus
    }
  }

  const pin = mediaType === "maps" ? parseMapPin(url) : null;
  const row = {
    url_hash: hash,
    url,
    title: preview.title,
    description: preview.description,
    image_url: preview.imageUrl,
    site_name: preview.siteName,
    duration_s: preview.durationS,
    domain,
    media_type: mediaType,
    lat: pin?.lat ?? null,
    lng: pin?.lng ?? null,
    fetched_at: new Date().toISOString(),
  };
  await admin.from("link_previews").upsert(row, { onConflict: "url_hash" });
  return json(200, toResponse(row));
});

function toResponse(row: {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  duration_s: number | null;
  domain: string | null;
  media_type: string;
  lat: number | null;
  lng: number | null;
}) {
  return {
    url: row.url,
    title: row.title,
    description: row.description,
    image: row.image_url,
    siteName: row.site_name,
    duration: row.duration_s,
    domain: row.domain,
    mediaType: row.media_type,
    pin: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null,
  };
}
