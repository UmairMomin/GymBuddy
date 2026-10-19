import { defineConfig } from "@playwright/test";

const PORT = 3100;

/**
 * End-to-end suite. It builds and serves the app from an isolated directory on its own port, and drives
 * the real Supabase project configured in .env.local with throwaway accounts (prefix `zz_e2e_`) that
 * global setup/teardown delete. Uses the installed Google Chrome (no browser download).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { NEXT_DIST_DIR: ".next-e2e" },
  },
});
