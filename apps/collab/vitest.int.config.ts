import { defineConfig } from "vitest/config";

// Integration suite: needs the local Supabase stack (`pnpm db:start`).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
