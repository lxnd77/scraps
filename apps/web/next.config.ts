import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@scraps/ui", "@scraps/db", "@scraps/editor"],
  // esbuild bundles the service worker inside a route handler (Serwist spike), keep it external.
  serverExternalPackages: ["esbuild"],
};

export default withSerwist(config);
