import { defineConfig, devices } from "@playwright/test";
import { E2E_DB, E2E_PORT } from "./e2e/config";

const baseURL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "e2e",
  // The dev server compiles pages on first use, which can take a while.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Its own port and data file, so a running `npm run dev` and its data are left alone.
  webServer: {
    // The server starts before globalSetup, so it seeds its data file itself.
    // a fresh build folder every run: the server is stopped by force at the end, so nothing of the last run is reused
    command: `npx tsx scripts/clean-e2e-build.ts .next-e2e && npm run reset-dev-data && npm run dev -- --port ${E2E_PORT}`,
    url: `${baseURL}/sign-in`,
    env: { INFOMAPPER_DEV_DB: E2E_DB, NEXT_DIST_DIR: ".next-e2e" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
