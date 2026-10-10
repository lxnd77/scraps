/**
 * What arrives through the share target or a drop on the board (SPEC 9.6, phase 7).
 * Pure functions only: the service worker, the capture sheet and the tests all use this file, so
 * it touches no DOM, React or Next APIs.
 */

/** A mood board holds up to nine pictures (editor schema). */
export const MAX_SHARED_IMAGES = 9;
export const MAX_SHARED_FILE_BYTES = 40 * 1024 * 1024;
const TEXT_MAX = 10_000;

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
  /** images first, then at most one audio file */
  files: File[];
}

export interface StoredShare extends SharePayload {
  id: string;
  createdAt: number;
}

/** What the capture sheet starts from. */
export type ShareKind = "link" | "pic" | "mood" | "voice" | "text";

/** The first http(s) address inside a string, without trailing sentence punctuation, or null. */
export function findUrl(value: string): string | null {
  const match = /https?:\/\/[^\s<>"']+/i.exec(value);
  if (!match) return null;
  const candidate = match[0].replace(/[),.;!?]+$/, "");
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function field(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, TEXT_MAX) : undefined;
}

/** Image and audio files only, within the size cap. Everything else is dropped silently. */
export function acceptSharedFiles(files: Iterable<File>): File[] {
  const images: File[] = [];
  const audio: File[] = [];
  for (const file of files) {
    if (file.size === 0 || file.size > MAX_SHARED_FILE_BYTES) continue;
    const type = file.type.toLowerCase();
    // some apps send HEIC with an empty type; the extension is the fallback
    const isImage = type.startsWith("image/") || (!type && /\.(heic|heif)$/i.test(file.name));
    if (isImage && images.length < MAX_SHARED_IMAGES) images.push(file);
    else if (type.startsWith("audio/") && audio.length < 1) audio.push(file);
  }
  return [...images, ...audio];
}

/**
 * Builds a payload from loose strings and files. Android apps often put the address in `text`
 * ("great video https://youtu.be/x"), so a link found there becomes `url` and the rest stays text.
 */
export function buildPayload(input: {
  title?: unknown;
  text?: unknown;
  url?: unknown;
  files?: Iterable<File>;
}): SharePayload {
  const title = field(input.title);
  let text = field(input.text);
  let url: string | undefined;

  const explicit = field(input.url);
  if (explicit) url = findUrl(explicit) ?? undefined;

  if (!url && text) {
    const found = findUrl(text);
    if (found) {
      url = found;
      const rest = text
        .replace(/https?:\/\/[^\s<>"']+/i, "")
        .replace(/\s+/g, " ")
        .trim();
      text = rest || undefined;
    }
  } else if (url && text) {
    // some apps repeat the address in the text; drop the repeat
    const withoutUrl = text.replace(/https?:\/\/[^\s<>"']+/gi, "").replace(/\s+/g, " ").trim();
    text = withoutUrl || undefined;
  }

  return { title, text, url, files: acceptSharedFiles(input.files ?? []) };
}

/** The multipart form the manifest's `share_target` posts. */
export function parseShareForm(form: FormData): SharePayload {
  const files: File[] = [];
  for (const value of form.getAll("files")) {
    if (typeof value !== "string") files.push(value);
  }
  return buildPayload({
    title: form.get("title"),
    text: form.get("text"),
    url: form.get("url"),
    files,
  });
}

/** Nothing worth opening the sheet for. */
export function isEmptyPayload(p: SharePayload): boolean {
  return !p.title && !p.text && !p.url && p.files.length === 0;
}

/** Which capture flow a payload starts: pictures win over a link, a link over plain text. */
export function shareKind(p: SharePayload): ShareKind | null {
  const images = p.files.filter((f) => f.type.startsWith("image/") || !f.type).length;
  if (images >= 2) return "mood";
  if (images === 1) return "pic";
  if (p.url) return "link";
  if (p.files.some((f) => f.type.startsWith("audio/"))) return "voice";
  if (p.title || p.text) return "text";
  return null;
}

/**
 * A payload from a drop on the board. Files come from `dataTransfer.files`; a dragged link or
 * selection arrives as `text/uri-list` or `text/plain`.
 */
export function payloadFromDrop(data: {
  files: Iterable<File>;
  getData: (type: string) => string;
}): SharePayload {
  const uriList = data
    .getData("text/uri-list")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
  return buildPayload({
    url: uriList,
    text: data.getData("text/plain"),
    files: data.files,
  });
}

/** True while the drag carries something the capture sheet can use (not a card or block drag). */
export function isCapturableDrag(types: ReadonlyArray<string>): boolean {
  return types.includes("Files") || types.includes("text/uri-list") || types.includes("text/plain");
}

export function newShareId(): string {
  return crypto.randomUUID();
}
