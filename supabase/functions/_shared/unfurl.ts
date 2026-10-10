// Pure parsing for link previews: Open Graph, <title>, ISO durations and map pins.
// No network here; unfurl-link fetches through the SSRF guard and hands the text in.

export interface ParsedPreview {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  durationS: number | null;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

function clean(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  const out = decodeEntities(text).replace(/\s+/g, " ").trim();
  return out ? out.slice(0, max) : null;
}

/** All `<meta ...>` tags as attribute maps (names lowercased). */
function metaTags(html: string): Array<Record<string, string>> {
  const tags: Array<Record<string, string>> = [];
  for (const match of html.matchAll(/<meta\s+([^>]*?)\/?>/gi)) {
    const attrs: Record<string, string> = {};
    for (const a of match[1]!.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      attrs[a[1]!.toLowerCase()] = a[3] ?? a[4] ?? a[5] ?? "";
    }
    tags.push(attrs);
  }
  return tags;
}

/** "PT1H2M3S" to seconds, or null. */
export function parseIsoDuration(value: string): number | null {
  const m = /^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/i.exec(value.trim());
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function absoluteHttp(value: string | undefined, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(value), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseHtmlPreview(html: string, pageUrl: string): ParsedPreview {
  const metas = metaTags(html);
  const byKey = new Map<string, string>();
  for (const tag of metas) {
    const key = (tag.property ?? tag.name ?? tag.itemprop ?? "").toLowerCase();
    const content = tag.content;
    if (key && content !== undefined && !byKey.has(key)) byKey.set(key, content);
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];

  const durationRaw = byKey.get("og:video:duration") ?? byKey.get("video:duration");
  const iso = byKey.get("duration");
  const durationS = durationRaw && /^\d+$/.test(durationRaw)
    ? Number(durationRaw)
    : iso
      ? parseIsoDuration(iso)
      : null;

  return {
    title: clean(byKey.get("og:title") ?? byKey.get("twitter:title") ?? titleTag, 200),
    description: clean(
      byKey.get("og:description") ?? byKey.get("twitter:description") ?? byKey.get("description"),
      400,
    ),
    imageUrl: absoluteHttp(
      byKey.get("og:image") ?? byKey.get("og:image:url") ?? byKey.get("twitter:image"),
      pageUrl,
    ),
    siteName: clean(byKey.get("og:site_name"), 80),
    durationS,
  };
}

export type MediaType = "article" | "video" | "maps";

const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com", "m.youtube.com", "music.youtube.com"];

function hostOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

export function isYouTube(url: URL): boolean {
  const host = hostOf(url);
  return host === "youtu.be" || host.endsWith("youtube.com");
}

export function detectMediaType(rawUrl: string): MediaType {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "article";
  }
  const host = hostOf(url);
  if (VIDEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return "video";
  if (
    host === "maps.app.goo.gl" ||
    host === "maps.apple.com" ||
    host === "openstreetmap.org" ||
    (host.endsWith("google.com") && url.pathname.startsWith("/maps"))
  ) {
    return "maps";
  }
  return "article";
}

/** Pulls a lat/lng pair out of the common map URL shapes, or null. */
export function parseMapPin(rawUrl: string): { lat: number; lng: number } | null {
  const candidates: string[] = [];
  try {
    const url = new URL(rawUrl);
    candidates.push(decodeURIComponent(url.pathname));
    for (const key of ["q", "ll", "sll", "query", "center"]) {
      const v = url.searchParams.get(key);
      if (v) candidates.push(v);
    }
    if (url.hash) candidates.push(url.hash.replace(/^#map=\d+\//, ""));
  } catch {
    return null;
  }
  for (const text of candidates) {
    const m = /(-?\d{1,2}(?:\.\d+)?)\s*[,/]\s*(-?\d{1,3}(?:\.\d+)?)/.exec(text);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}
