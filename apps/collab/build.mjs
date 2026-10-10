// Bundles the collab server into one file for deployment.
// Workspace packages (@scraps/editor, @scraps/db) ship as TypeScript source, and pnpm's strict
// node_modules means a bundled file could not resolve their dependencies at runtime anyway, so
// everything is bundled except Node built-ins.
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  logLevel: "info",
  // some CommonJS dependencies call require() at runtime
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});
