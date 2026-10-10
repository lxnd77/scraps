import { describe, expect, it } from "vitest";
import {
  BlockedUrlError,
  assertPublicUrl,
  isBlockedIp,
  safeFetch,
  type Resolver,
} from "./ssrf";

const publicIp = "93.184.216.34";
const resolveTo =
  (...ips: string[]): Resolver =>
  async () =>
    ips;

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1",
    "127.1.2.3",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "ff02::1",
    "::ffff:10.0.0.1",
    "::ffff:a00:1",
    "::ffff:7f00:1",
    "64:ff9b::a00:1",
    "2002:a00:1::1",
    "2001:db8::1",
    "[::1]",
    "not an ip",
  ])("blocks %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each([publicIp, "8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    },
  );
});

describe("assertPublicUrl", () => {
  const refused = async (url: string, resolve: Resolver = resolveTo(publicIp)) => {
    const error = await assertPublicUrl(url, resolve).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BlockedUrlError);
    return (error as BlockedUrlError).reason;
  };

  it("refuses the metadata address and other literals", async () => {
    expect(await refused("http://169.254.169.254/latest/meta-data")).toBe("blocked_ip");
    expect(await refused("http://127.0.0.1/")).toBe("blocked_ip");
    expect(await refused("http://[::1]/")).toBe("blocked_ip");
    expect(await refused("http://[::ffff:10.0.0.1]/")).toBe("blocked_ip");
  });

  it("refuses alternate spellings that URL parsing normalises", async () => {
    expect(await refused("http://2130706433/")).toBe("blocked_ip"); // 127.0.0.1 as an integer
    expect(await refused("http://0x7f.1/")).toBe("blocked_ip");
    expect(await refused("http://0177.0.0.1/")).toBe("blocked_ip");
  });

  it("refuses a hostname that resolves to a private address", async () => {
    expect(await refused("https://intranet.example.com/", resolveTo("10.0.0.1"))).toBe(
      "blocked_ip",
    );
  });

  it("refuses a name with one public and one private answer", async () => {
    expect(await refused("https://mixed.example.com/", resolveTo(publicIp, "10.0.0.5"))).toBe(
      "blocked_ip",
    );
  });

  it("refuses unresolvable names, internal names, bad schemes, ports and credentials", async () => {
    expect(await refused("https://nope.example.com/", async () => [])).toBe("unresolvable");
    expect(
      await refused("https://nope.example.com/", async () => {
        throw new Error("nxdomain");
      }),
    ).toBe("unresolvable");
    expect(await refused("http://localhost/")).toBe("blocked_host");
    expect(await refused("http://printer.local/")).toBe("blocked_host");
    expect(await refused("http://intranet/")).toBe("blocked_host");
    expect(await refused("ftp://example.com/")).toBe("scheme");
    expect(await refused("file:///etc/passwd")).toBe("scheme");
    expect(await refused("http://example.com:22/")).toBe("port");
    expect(await refused("http://user:pw@example.com/")).toBe("credentials");
    expect(await refused("not a url")).toBe("invalid_url");
  });

  it("accepts a public host", async () => {
    const url = await assertPublicUrl("https://example.com/a?b=1", resolveTo(publicIp));
    expect(url.hostname).toBe("example.com");
  });
});

function response(body: string, init: ResponseInit = {}) {
  return new Response(body, init);
}

describe("safeFetch", () => {
  it("returns the body of a public page", async () => {
    const result = await safeFetch("https://example.com/", {
      resolve: resolveTo(publicIp),
      fetchImpl: async () => response("<title>hi</title>", { status: 200 }),
    });
    expect(new TextDecoder().decode(result.body)).toBe("<title>hi</title>");
    expect(result.truncated).toBe(false);
  });

  it("re-validates every redirect hop", async () => {
    const hops: string[] = [];
    const error = await safeFetch("https://example.com/start", {
      resolve: resolveTo(publicIp),
      fetchImpl: async (input) => {
        hops.push(String(input));
        return response("", {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data" },
        });
      },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BlockedUrlError);
    expect((error as BlockedUrlError).reason).toBe("blocked_ip");
    // the metadata address was never requested
    expect(hops).toEqual(["https://example.com/start"]);
  });

  it("catches DNS rebinding: a name that is public once and private on the redirect target", async () => {
    let calls = 0;
    const rebinding: Resolver = async (host) => {
      if (host === "evil.example.com") return ++calls === 1 ? [publicIp] : ["10.0.0.1"];
      return [publicIp];
    };
    const error = await safeFetch("https://start.example.com/", {
      resolve: rebinding,
      fetchImpl: async (input) =>
        String(input).startsWith("https://start.")
          ? response("", { status: 301, headers: { location: "https://evil.example.com/a" } })
          : response("", { status: 301, headers: { location: "https://evil.example.com/b" } }),
    }).catch((e: unknown) => e);
    expect((error as BlockedUrlError).reason).toBe("blocked_ip");
  });

  it("stops after three redirects", async () => {
    const error = await safeFetch("https://example.com/", {
      resolve: resolveTo(publicIp),
      fetchImpl: async () =>
        response("", { status: 302, headers: { location: "https://example.com/again" } }),
    }).catch((e: unknown) => e);
    expect((error as BlockedUrlError).reason).toBe("too_many_redirects");
  });

  it("caps the body", async () => {
    const result = await safeFetch("https://example.com/", {
      resolve: resolveTo(publicIp),
      maxBytes: 10,
      fetchImpl: async () => response("x".repeat(1000)),
    });
    expect(result.body.length).toBe(10);
    expect(result.truncated).toBe(true);
  });

  it("times out", async () => {
    const error = await safeFetch("https://example.com/", {
      resolve: resolveTo(publicIp),
      timeoutMs: 30,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    }).catch((e: unknown) => e);
    expect((error as BlockedUrlError).reason).toBe("timeout");
  });
});
