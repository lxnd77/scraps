import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const COLLAB_PORT = 1234;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // a fake microphone so the voice memo test can record without a person
    launchOptions: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    {
      // iPhone 14 profile on Chromium so one browser install covers both projects
      name: "iphone-14",
      use: { ...devices["iPhone 14"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      // e2e runs against a production build, which is also what the service worker spike needs
      command: `pnpm build && pnpm exec next start --port ${PORT}`,
      url: `http://localhost:${PORT}/styleguide`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      stdout: "pipe",
    },
    {
      // Edge Functions (unfurl-link); the local Supabase stack must already be running
      command: "pnpm exec supabase functions serve --no-verify-jwt",
      cwd: "../..",
      url: "http://127.0.0.1:54321/functions/v1/unfurl-link",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // the collab server: reads apps/collab/.env.local locally, process env in CI
      command: "pnpm --filter @scraps/collab exec tsx --env-file-if-exists=.env.local src/index.ts",
      url: `http://localhost:${COLLAB_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "pipe",
    },
  ],
});
