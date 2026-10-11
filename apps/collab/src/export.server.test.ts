import { afterEach, describe, expect, it } from "vitest";
import { ExportRateLimited, type Exporter } from "./export.js";
import { createCollabServer } from "./server.js";
import { FakeStore, fakeVerify, httpUrl, noKeepAlive, uid } from "./testing.js";

const USER = uid(1);
let server: ReturnType<typeof createCollabServer> | null = null;

async function start(exporter?: Exporter) {
  server = createCollabServer({
    verifyToken: fakeVerify,
    store: new FakeStore(),
    internalSecret: "test-internal-secret-0123",
    allowedOrigins: [],
    exporter,
  });
  await server.listen(0);
  return httpUrl(server);
}

const post = (base: string, token: string | null) =>
  fetch(`${base}/export`, {
    method: "POST",
    headers: { ...noKeepAlive, ...(token ? { authorization: `Bearer user:${token}` } : {}) },
  });

afterEach(async () => {
  await server?.destroy();
  server = null;
});

describe("POST /export", () => {
  it("returns the link for the signed-in person only", async () => {
    const seen: string[] = [];
    const base = await start({
      run: async (userId) => {
        seen.push(userId);
        return { url: "https://signed.test/zip", notes: 3, files: 1, skipped: 0 };
      },
    });
    const res = await post(base, USER);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://signed.test/zip",
      notes: 3,
      files: 1,
      skipped: 0,
    });
    expect(seen).toEqual([USER]);
  });

  it("refuses anonymous callers without building anything", async () => {
    let ran = false;
    const base = await start({
      run: async () => {
        ran = true;
        return { url: "", notes: 0, files: 0, skipped: 0 };
      },
    });
    expect((await post(base, null)).status).toBe(401);
    expect(ran).toBe(false);
  });

  it("maps the daily limit to 429 and failures to 500", async () => {
    const limited = await start({
      run: async () => {
        throw new ExportRateLimited();
      },
    });
    expect((await post(limited, USER)).status).toBe(429);
    await server?.destroy();

    const broken = await start({
      run: async () => {
        throw new Error("storage down");
      },
    });
    const res = await post(broken, USER);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal_error" });
  });

  it("is not available without an exporter", async () => {
    const base = await start();
    expect((await post(base, USER)).status).toBe(501);
  });
});
