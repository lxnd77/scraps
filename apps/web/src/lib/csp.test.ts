import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaders } from "./csp";

const input = {
  supabaseUrl: "https://abc.supabase.co",
  collabUrl: "wss://collab.example.com",
};

describe("buildCsp", () => {
  const csp = buildCsp(input);
  const directive = (name: string) =>
    csp
      .split("; ")
      .find((d) => d.startsWith(`${name} `))
      ?.split(" ")
      .slice(1) ?? [];

  it("is closed by default and cannot be framed or given plugins", () => {
    expect(directive("default-src")).toEqual(["'self'"]);
    expect(directive("object-src")).toEqual(["'none'"]);
    expect(directive("frame-ancestors")).toEqual(["'none'"]);
    expect(directive("base-uri")).toEqual(["'self'"]);
    expect(directive("form-action")).toEqual(["'self'"]);
  });

  it("allows only this app, supabase and the collab server to be connected to", () => {
    expect(directive("connect-src")).toEqual([
      "'self'",
      "blob:",
      "data:",
      "https://abc.supabase.co",
      "wss://abc.supabase.co",
      "https://collab.example.com",
      "wss://collab.example.com",
    ]);
  });

  it("lets media and pictures load from supabase storage", () => {
    expect(directive("img-src")).toContain("https://abc.supabase.co");
    expect(directive("media-src")).toContain("https://abc.supabase.co");
  });

  it("adds eval only in development and sentry only when configured", () => {
    expect(directive("script-src")).not.toContain("'unsafe-eval'");
    expect(directive("connect-src").join(" ")).not.toContain("sentry");
    const dev = buildCsp({ ...input, dev: true, sentryHost: "o1.ingest.sentry.io" });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("https://o1.ingest.sentry.io");
  });

  it("survives a missing or malformed url", () => {
    expect(() => buildCsp({ supabaseUrl: "", collabUrl: "nope" })).not.toThrow();
  });
});

describe("securityHeaders", () => {
  it("sets HSTS only in production and always blocks sniffing and framing", () => {
    const names = (production: boolean) =>
      securityHeaders({ ...input, production }).map((h) => h.key);
    expect(names(true)).toContain("Strict-Transport-Security");
    expect(names(false)).not.toContain("Strict-Transport-Security");
    expect(names(false)).toEqual(
      expect.arrayContaining(["X-Content-Type-Options", "X-Frame-Options", "Permissions-Policy"]),
    );
  });
});
