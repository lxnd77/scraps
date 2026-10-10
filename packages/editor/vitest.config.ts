import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // node by default (the server-side schema must work with no DOM); files that need a DOM opt in
  // with a `// @vitest-environment jsdom` comment
  test: { environment: "node", globals: true, include: ["src/**/*.test.ts"] },
});
