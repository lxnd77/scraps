import { describe, expect, it } from "vitest";
import { scrubEvent, scrubString } from "./index";

describe("scrubString", () => {
  it("redacts tokens, keys and emails", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop";
    const capture = "scr_" + "a".repeat(64);
    expect(scrubString(`Bearer ${jwt} for maya@example.com`)).toBe("Bearer [jwt] for [email]");
    expect(scrubString(`token ${capture}`)).toBe("token [capture-token]");
    expect(scrubString("key sb_secret_abcdefghijklmnop")).toBe("key [supabase-key]");
  });

  it("drops query strings and fragments from urls but keeps the path", () => {
    expect(scrubString("GET https://x.test/n/123?token=abc&q=my%20secret#frag failed")).toBe(
      "GET https://x.test/n/123 failed",
    );
  });
});

describe("scrubEvent", () => {
  it("drops content-bearing and credential keys at any depth", () => {
    const event = {
      message: "save failed for maya@example.com",
      request: {
        url: "https://app.test/n/1?next=/private",
        headers: { Authorization: "Bearer x", "x-internal-secret": "s", accept: "*/*" },
        cookies: "a=b",
        data: { text: "my private scrap" },
      },
      extra: { title: "goa trip", noteId: "n1", nested: { transcript: "words", ok: 1 } },
      breadcrumbs: [{ category: "fetch", data: { url: "https://s.test/rest?select=*", body: "{}" } }],
    };
    const out = scrubEvent(event);
    expect(out.message).toBe("save failed for [email]");
    expect(out.request.url).toBe("https://app.test/n/1");
    expect(out.request.headers).toEqual({
      Authorization: "[redacted]",
      "x-internal-secret": "[redacted]",
      accept: "*/*",
    });
    expect(out.request.cookies).toBe("[redacted]");
    expect(out.request.data).toBe("[redacted]");
    expect(out.extra).toEqual({
      title: "[redacted]",
      noteId: "n1",
      nested: { transcript: "[redacted]", ok: 1 },
    });
    expect(out.breadcrumbs[0]!.data).toBe("[redacted]");
    expect(JSON.stringify(out)).not.toContain("private scrap");
  });

  it("reduces the user to an id and does not mutate the input", () => {
    const event = { user: { id: "u1", email: "a@b.co", username: "maya", ip_address: "1.2.3.4" } };
    expect(scrubEvent(event).user).toEqual({ id: "u1" });
    expect(event.user.email).toBe("a@b.co");
    expect(scrubEvent({ user: { email: "a@b.co" } }).user).toBeUndefined();
  });

  it("stops at a sane depth instead of recursing forever", () => {
    let deep: Record<string, unknown> = { v: "x" };
    for (let i = 0; i < 30; i += 1) deep = { next: deep };
    expect(() => scrubEvent(deep)).not.toThrow();
  });
});
