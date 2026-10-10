// Pure helpers for the `capture` Edge Function: token shape and hashing, body validation and
// deciding what kind of scrap a request becomes. No Deno or Node APIs, so the unit tests import it
// through packages/db like the SSRF guard.

export const TOKEN_PATTERN = /^scr_[0-9a-f]{64}$/;
export const MAX_TEXT = 10_000;
export const MAX_TITLE = 120;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** The bearer token from an Authorization header, or null when it is missing or malformed. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  return TOKEN_PATTERN.test(match[1]!) ? match[1]! : null;
}

/** SHA-256 as lowercase hex: what `capture_tokens.token_hash` holds. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CaptureInput {
  url?: string;
  text?: string;
  title?: string;
}

export type ParsedInput =
  { ok: true; value: CaptureInput } | { ok: false; error: "invalid_request" | "empty" };

/** The first http(s) link inside a share string ("have a look https://… thanks"), or null. */
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

function clean(value: unknown, max: number): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > max) return null;
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Validates `{ url?, text?, title? }` from the JSON body or the multipart fields. A url hidden in
 * `text` (the iOS share sheet sends both) is promoted when no `url` came with it.
 */
export function parseCaptureInput(raw: unknown, { allowEmpty = false } = {}): ParsedInput {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "invalid_request" };
  }
  const body = raw as Record<string, unknown>;
  const url = clean(body.url, 2048);
  const text = clean(body.text, MAX_TEXT);
  const title = clean(body.title, MAX_TITLE);
  if (url === null || text === null || title === null)
    return { ok: false, error: "invalid_request" };

  const value: CaptureInput = {};
  if (url !== undefined) {
    const parsed = findUrl(url);
    if (!parsed) return { ok: false, error: "invalid_request" };
    value.url = parsed;
  }
  if (text !== undefined) value.text = text;
  if (title !== undefined) value.title = title;

  if (!value.url && value.text) {
    const found = findUrl(value.text);
    // the whole text is the link, or the link is the only thing worth keeping
    if (found && value.text.replace(found, "").replace(/[\s()<>"']/g, "").length === 0) {
      value.url = found;
      delete value.text;
    }
  }

  if (!allowEmpty && !value.url && !value.text && !value.title)
    return { ok: false, error: "empty" };
  return { ok: true, value };
}

export interface NoteStart {
  start: "text" | "link" | "image";
  title?: string;
  text?: string;
  url?: string;
}

/** What a capture becomes: a link when there is a url, a text scrap otherwise. */
export function planNote(input: CaptureInput, hasImage: boolean): NoteStart {
  if (hasImage) return { start: "image", title: input.title ?? firstLine(input.text) };
  if (input.url) return { start: "link", url: input.url, title: input.title };
  const lines = (input.text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (input.title)
    return { start: "text", title: input.title, text: lines.join("\n") || undefined };
  const [first, ...rest] = lines;
  if (!first) return { start: "text" };
  if (first.length > MAX_TITLE) return { start: "text", text: lines.join("\n") };
  return { start: "text", title: first, text: rest.join("\n") || undefined };
}

function firstLine(text: string | undefined): string | undefined {
  const line = text
    ?.split(/\r?\n/)
    .find((l) => l.trim())
    ?.trim();
  return line ? line.slice(0, MAX_TITLE) : undefined;
}

/** UUID v7 (time ordered), like the ids the clients generate. Random bytes are injected for tests. */
export function uuidv7(
  now = Date.now(),
  random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const bytes = random(16);
  bytes[0] = Math.floor(now / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(now / 2 ** 32) & 0xff;
  bytes[2] = (now >>> 24) & 0xff;
  bytes[3] = (now >>> 16) & 0xff;
  bytes[4] = (now >>> 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
