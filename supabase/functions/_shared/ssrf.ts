// SSRF guard for anything that fetches a user-supplied URL (SPEC 11.4, 12).
// Pure TypeScript: no Deno or Node APIs, so the Edge Function, the web image proxy and the unit
// tests all import this one file. DNS resolution and fetch are injected.

export type Resolver = (hostname: string) => Promise<string[]>;

export class BlockedUrlError extends Error {
  constructor(
    readonly reason:
      | "invalid_url"
      | "scheme"
      | "port"
      | "credentials"
      | "blocked_host"
      | "blocked_ip"
      | "unresolvable"
      | "too_many_redirects"
      | "too_large"
      | "timeout"
      | "bad_status",
    message?: string,
  ) {
    super(message ?? reason);
  }
}

/** Dotted IPv4 to a 32-bit number, or null when it is not a plain dotted quad. */
function parseV4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

const V4_BLOCKS: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved and broadcast
];

function v4Blocked(n: number): boolean {
  return V4_BLOCKS.some(([base, bits]) => {
    const b = parseV4(base)!;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((b & mask) >>> 0);
  });
}

/** Expands an IPv6 literal (no brackets, no zone) to eight 16-bit groups, or null. */
function parseV6(ip: string): number[] | null {
  let text = ip.toLowerCase();
  const zone = text.indexOf("%");
  if (zone !== -1) text = text.slice(0, zone);

  // trailing dotted quad becomes two groups
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseV4(tail);
    if (v4 === null) return null;
    text = `${text.slice(0, lastColon + 1)}${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const toGroups = (s: string) => (s === "" ? [] : s.split(":"));
  const head = toGroups(halves[0]!);
  const rest = halves.length === 2 ? toGroups(halves[1]!) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const all = halves.length === 1 ? head : [...head, ...Array<string>(missing).fill("0"), ...rest];
  const out: number[] = [];
  for (const group of all) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    out.push(parseInt(group, 16));
  }
  return out.length === 8 ? out : null;
}

function embeddedV4(groups: number[]): number {
  return (((groups[6]! << 16) | groups[7]!) >>> 0) as number;
}

/** True for any address a public fetch must never reach. Unparseable input counts as blocked. */
export function isBlockedIp(ip: string): boolean {
  const trimmed = ip.trim().replace(/^\[|\]$/g, "");
  const v4 = parseV4(trimmed);
  if (v4 !== null) return v4Blocked(v4);

  const g = parseV6(trimmed);
  if (!g) return true;
  const allZeroTo = (n: number) => g.slice(0, n).every((x) => x === 0);

  if (allZeroTo(7) && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1
  if (allZeroTo(5) && g[5] === 0xffff) return v4Blocked(embeddedV4(g)); // v4-mapped
  if (allZeroTo(6)) return v4Blocked(embeddedV4(g)); // v4-compatible
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return v4Blocked(embeddedV4(g)); // NAT64
  }
  if (g[0] === 0x2002) return v4Blocked((((g[1]! << 16) | g[2]!) >>> 0) as number); // 6to4
  if ((g[0]! & 0xffc0) === 0xfe80) return true; // link-local
  if ((g[0]! & 0xfe00) === 0xfc00) return true; // unique local
  if ((g[0]! & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  return false;
}

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp"];

function isIpLiteral(host: string): boolean {
  return parseV4(host) !== null || host.startsWith("[") || host.includes(":");
}

/** Syntax checks that need no DNS: scheme, port, credentials, obviously internal names. */
export function parsePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError("scheme");
  if (url.username || url.password) throw new BlockedUrlError("credentials");
  if (url.port && url.port !== "80" && url.port !== "443") throw new BlockedUrlError("port");

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new BlockedUrlError("invalid_url");
  if (host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new BlockedUrlError("blocked_host");
  }
  if (!isIpLiteral(host) && !host.includes(".")) throw new BlockedUrlError("blocked_host");
  return url;
}

/**
 * Parses the URL and checks every address its host resolves to. All addresses must be public:
 * a name that resolves to one public and one private address is refused, not sampled.
 */
export async function assertPublicUrl(raw: string, resolve: Resolver): Promise<URL> {
  const url = parsePublicUrl(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (isIpLiteral(url.hostname)) {
    if (isBlockedIp(host)) throw new BlockedUrlError("blocked_ip");
    return url;
  }

  let addresses: string[];
  try {
    addresses = await resolve(host);
  } catch {
    throw new BlockedUrlError("unresolvable");
  }
  if (addresses.length === 0) throw new BlockedUrlError("unresolvable");
  if (addresses.some(isBlockedIp)) throw new BlockedUrlError("blocked_ip");
  return url;
}

export interface SafeFetchOptions {
  resolve: Resolver;
  fetchImpl?: typeof fetch;
  maxRedirects?: number;
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
}

export interface SafeFetchResult {
  /** the URL of the last hop */
  url: string;
  status: number;
  headers: Headers;
  body: Uint8Array;
  /** true when the body was cut at maxBytes */
  truncated: boolean;
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/**
 * GET with the guard applied on every hop: redirects are followed by hand (max 3), each target
 * is re-validated and re-resolved just before it is requested, the whole call has one deadline
 * and the body is capped. A body over the cap is truncated rather than rejected so the HTML head
 * of a large page still parses.
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions): Promise<SafeFetchResult> {
  const {
    resolve,
    fetchImpl = fetch,
    maxRedirects = 3,
    timeoutMs = 5000,
    maxBytes = 1_048_576,
    headers = {},
  } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let current = rawUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const url = await assertPublicUrl(current, resolve);
      let response: Response;
      try {
        response = await fetchImpl(url.toString(), {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers,
        });
      } catch (error) {
        if (controller.signal.aborted) throw new BlockedUrlError("timeout");
        throw error;
      }

      if (REDIRECTS.has(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new BlockedUrlError("bad_status");
        current = new URL(location, url).toString();
        continue;
      }

      const { body, truncated } = await readCapped(response, maxBytes, controller.signal);
      return { url: url.toString(), status: response.status, headers: response.headers, body, truncated };
    }
    throw new BlockedUrlError("too_many_redirects");
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<{ body: Uint8Array; truncated: boolean }> {
  if (!response.body) return { body: new Uint8Array(), truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  try {
    while (true) {
      if (signal.aborted) throw new BlockedUrlError("timeout");
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.length > maxBytes) {
        chunks.push(value.slice(0, maxBytes - size));
        size = maxBytes;
        truncated = true;
        break;
      }
      chunks.push(value);
      size += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const body = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    body.set(chunk, at);
    at += chunk.length;
  }
  return { body, truncated };
}
