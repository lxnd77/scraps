/**
 * Content Security Policy and the other response headers (SPEC 12, Phase 9.7).
 *
 * Scripts allow 'unsafe-inline' because Next's bootstrap and the theme init script are inline.
 * A per-request nonce through the proxy is the way to remove that; it is recorded as a known gap
 * in PROGRESS rather than half done here. Everything else is locked to this app, Supabase, the
 * collab server and (when configured) Sentry.
 */
export interface CspInput {
  supabaseUrl: string;
  collabUrl: string;
  /** a Sentry DSN host such as o123.ingest.sentry.io; omitted when monitoring is off */
  sentryHost?: string;
  /** dev needs eval for fast refresh; production never does */
  dev?: boolean;
}

function origin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** http(s) origin to its ws(s) twin, for WebSocket connections. */
function wsOrigin(httpOrigin: string): string {
  return httpOrigin.replace(/^http/, "ws");
}

export function buildCsp(input: CspInput): string {
  const supabase = origin(input.supabaseUrl);
  // the collab URL is configured as ws(s)://…; both schemes are needed (WebSocket and POST /notes)
  const collabHttp = origin(input.collabUrl.replace(/^ws/, "http"));
  const connect = new Set<string>(["'self'", "blob:", "data:"]);
  const media = new Set<string>(["'self'", "blob:"]);
  const img = new Set<string>(["'self'", "data:", "blob:"]);

  if (supabase) {
    connect.add(supabase);
    connect.add(wsOrigin(supabase));
    media.add(supabase);
    img.add(supabase);
  }
  if (collabHttp) {
    connect.add(collabHttp);
    connect.add(wsOrigin(collabHttp));
  }
  if (input.sentryHost) connect.add(`https://${input.sentryHost}`);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(input.dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [...img],
    "media-src": [...media],
    "font-src": ["'self'", "data:"],
    "connect-src": [...connect],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export interface HeaderRule {
  key: string;
  value: string;
}

export function securityHeaders(input: CspInput & { production: boolean }): HeaderRule[] {
  const headers: HeaderRule[] = [
    { key: "Content-Security-Policy", value: buildCsp(input) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // the voice recorder needs the microphone; nothing needs the rest
    {
      key: "Permissions-Policy",
      value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=()",
    },
    { key: "X-Frame-Options", value: "DENY" },
  ];
  if (input.production) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  }
  return headers;
}
