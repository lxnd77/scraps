// The unfurl pipeline shared by `unfurl-link` (signed-in users) and `capture` (token callers):
// normalise, check the 7 day cache, fetch through the SSRF guard, parse Open Graph, store.
// Deno only: it resolves DNS with the runtime and takes a service role client.
import type { SupabaseClient } from "@supabase/supabase-js";
import { BlockedUrlError, parsePublicUrl, safeFetch, type Resolver } from "./ssrf.ts";
import {
  detectMediaType,
  isYouTube,
  parseHtmlPreview,
  parseMapPin,
  type MediaType,
} from "./unfurl.ts";

const FRESH_MS = 7 * 24 * 60 * 60 * 1000;

export interface UnfurlResult {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  duration: number | null;
  domain: string | null;
  mediaType: string;
  pin: { lat: number; lng: number } | null;
}

export const resolveDns: Resolver = async (hostname) => {
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

/**
 * Throws BlockedUrlError for a url that must not be fetched. An unreachable site still resolves to
 * a plain domain card, so callers can always save the link.
 */
export async function unfurlUrl(admin: SupabaseClient, rawUrl: string): Promise<UnfurlResult> {
  const url = normalise(rawUrl);
  const hash = await sha256Hex(url);
  const { data: cached } = await admin
    .from("link_previews")
    .select("*")
    .eq("url_hash", hash)
    .maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < FRESH_MS) {
    return toResponse(cached);
  }

  const mediaType: MediaType = detectMediaType(url);
  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname.replace(/^www\./, "");
  let preview = {
    title: null as string | null,
    description: null as string | null,
    imageUrl: null as string | null,
    siteName: null as string | null,
    durationS: null as number | null,
  };

  try {
    const page = await safeFetch(url, {
      resolve: resolveDns,
      headers: { "user-agent": "ScrapsLinkPreview/1.0", accept: "text/html,*/*;q=0.5" },
    });
    const type = page.headers.get("content-type") ?? "";
    if (page.status < 400 && /html|xml/i.test(type)) {
      preview = parseHtmlPreview(new TextDecoder().decode(page.body), page.url);
    }
  } catch (error) {
    if (error instanceof BlockedUrlError) throw error;
    // an unreachable site still gets a plain domain card below
  }

  if (isYouTube(parsedUrl) && (!preview.title || !preview.imageUrl)) {
    try {
      const oembed = await safeFetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
        { resolve: resolveDns, maxBytes: 64 * 1024 },
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
  return toResponse(row);
}

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
}): UnfurlResult {
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
