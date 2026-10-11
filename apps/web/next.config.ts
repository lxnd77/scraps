import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/csp";

const production = process.env.NODE_ENV === "production";

/** The ingest host out of a DSN, so the CSP lets error reports through and nothing else. */
function sentryHost(dsn: string | undefined): string | undefined {
  try {
    return dsn ? new URL(dsn).host : undefined;
  } catch {
    return undefined;
  }
}

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@scraps/ui", "@scraps/db", "@scraps/editor"],
  // esbuild bundles the service worker inside a route handler (Serwist spike), keep it external.
  serverExternalPackages: ["esbuild"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
          collabUrl: process.env.NEXT_PUBLIC_COLLAB_URL ?? "ws://localhost:1234",
          sentryHost: sentryHost(process.env.NEXT_PUBLIC_SENTRY_DSN),
          dev: !production,
          production,
        }),
      },
    ];
  },
};

export default withSerwist(config);
