// Scrubbing for error reports (SPEC 12: "never log note content"). Pure: no Deno or Node APIs.
// Every Sentry event from the web app, the collab server and the Edge Functions goes through
// scrubEvent before it leaves, so a stack trace or breadcrumb can never carry a scrap's text,
// a title, a token, an email or a query string.

/** Keys whose value is dropped whatever it holds. Compared case-insensitively. */
const DROP_KEYS = new Set([
  "authorization",
  "cookie",
  "cookies",
  "set-cookie",
  "x-internal-secret",
  "apikey",
  "api_key",
  "access_token",
  "refresh_token",
  "token",
  "password",
  "secret",
  "email",
  "data",
  "body",
  "text",
  "content",
  "title",
  "transcript",
  "display_name",
  "displayname",
  "preview_text",
  "search_text",
]);

const REDACTED = "[redacted]";
const MAX_DEPTH = 8;

const PATTERNS: Array<[RegExp, string]> = [
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[jwt]"],
  [/\bscr_[0-9a-f]{64}\b/g, "[capture-token]"],
  [/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}\b/g, "[supabase-key]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
];

/** Redacts token-like and email-like text and drops the query string and fragment of a URL. */
export function scrubString(value: string): string {
  let out = value;
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  // https://host/path?secret=1#x  ->  https://host/path
  out = out.replace(/(https?:\/\/[^\s"'<>?#]+)[?#][^\s"'<>]*/g, "$1");
  return out;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return REDACTED;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = DROP_KEYS.has(key.toLowerCase()) ? REDACTED : scrubValue(inner, depth + 1);
  }
  return out;
}

/**
 * A scrubbed deep copy of a Sentry event (or breadcrumb, or any object). The user is reduced to an
 * id: no email, name or IP.
 */
export function scrubEvent<T>(event: T): T {
  const copy = scrubValue(event, 0) as Record<string, unknown> | T;
  if (copy && typeof copy === "object" && "user" in (copy as Record<string, unknown>)) {
    const user = (event as { user?: { id?: unknown } }).user;
    (copy as Record<string, unknown>).user =
      user && typeof user.id === "string" ? { id: user.id } : undefined;
  }
  return copy as T;
}
