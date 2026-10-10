import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

import { SignedUrlCache } from "./signedUrl";

function setup() {
  let now = 1_000_000;
  const fetcher = vi.fn(async (paths: string[]) => {
    return new Map(paths.map((p) => [p, `https://signed/${p}?t=${now}`]));
  });
  const cache = new SignedUrlCache(fetcher, () => now);
  return { cache, fetcher, advance: (ms: number) => (now += ms) };
}

describe("SignedUrlCache", () => {
  it("batches lookups from the same tick into one request", async () => {
    const { cache, fetcher } = setup();
    const [a, b] = await Promise.all([cache.get("n/a.webp"), cache.get("n/b.webp")]);
    expect(a).toContain("n/a.webp");
    expect(b).toContain("n/b.webp");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![0]).toEqual(["n/a.webp", "n/b.webp"]);
  });

  it("serves a cached url without asking again", async () => {
    const { cache, fetcher } = setup();
    const first = await cache.get("n/a.webp");
    const second = await cache.get("n/a.webp");
    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refreshes once less than ten minutes remain", async () => {
    const { cache, fetcher, advance } = setup();
    await cache.get("n/a.webp");
    advance(49 * 60 * 1000);
    expect(cache.peek("n/a.webp")).not.toBeNull();
    advance(2 * 60 * 1000);
    expect(cache.peek("n/a.webp")).toBeNull();
    await cache.get("n/a.webp");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("tells the hook when to refresh", async () => {
    const { cache } = setup();
    expect(cache.refreshIn("n/a.webp")).toBeNull();
    await cache.get("n/a.webp");
    expect(cache.refreshIn("n/a.webp")).toBe(50 * 60 * 1000);
  });

  it("resolves null when the lookup fails and does not cache it", async () => {
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    const cache = new SignedUrlCache(failing);
    expect(await cache.get("n/a.webp")).toBeNull();
    expect(cache.peek("n/a.webp")).toBeNull();
  });
});
