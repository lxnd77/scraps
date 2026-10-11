import { defineConfig } from "vitest/config";

// Fast suite: fakes only, runs in `pnpm check`. The Supabase-backed suite is vitest.int.config.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.int.test.ts", "node_modules/**"],
    testTimeout: 15_000,
    // Hocuspocus treats listen(0) as its default port, so servers from two files would collide
    fileParallelism: false,
  },
});
