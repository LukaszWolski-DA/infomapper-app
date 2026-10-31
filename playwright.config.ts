import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE, E2E_DB, E2E_PORT, E2E_PRODUCTION } from "./e2e/config";

const baseURL = E2E_BASE;

export default defineConfig({
  testDir: "e2e",
  // element counts, the live canvas's pan and zoom (S3B-15 a, c), the fading scenarios (slice 4p), slice 4b-1's
  // measurements to the screen (S4B1-09), slice 4b-2's measuring specs (S4B2-10 to S4B2-13, S4B2-15's layers) and slice
  // 5a's diagnosis (S5A-08) and slice 6a's (S6A-09) only
  // mean something
  // in the measurement build
  // and the S4P-04 screenshots (slice 4p) run only when asked with SCREENS=1
  testIgnore: [
    ...(E2E_PRODUCTION ? [] : ["**/*-elements.spec.ts", "**/S3B-15-live.spec.ts", "**/S4P-fading.spec.ts", "**/S4P-10-c08.spec.ts", "**/S4P-11-index.spec.ts", "**/S4B1-09.spec.ts", "**/S4B2-1[0-3].spec.ts", "**/S4B2-15-layers.spec.ts", "**/S5A-08.spec.ts", "**/S6A-09*.spec.ts", "**/S6B-10.spec.ts", "**/S7A-14-review.spec.ts", "**/S7B-16-*.spec.ts", "**/S10A-12*.spec.ts", "**/S10B-10*.spec.ts", "**/S11-13.spec.ts"]),
    ...(process.env.SCREENS ? [] : ["**/*-screens.spec.ts"]),
    // slice 6b's smoke for Firefox and WebKit runs only when asked (BROWSERS=1); CI and the full run stay Chromium-only
    ...(process.env.BROWSERS ? [] : ["**/*-browsers.spec.ts"]),
  ],
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
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // BROWSERS=1: the smoke specs (`*-browsers.spec.ts`) in Firefox and WebKit too
    ...(process.env.BROWSERS
      ? [
          { name: "firefox", use: { ...devices["Desktop Firefox"] }, testMatch: "**/*-browsers.spec.ts" },
          { name: "webkit", use: { ...devices["Desktop Safari"] }, testMatch: "**/*-browsers.spec.ts" },
        ]
      : []),
  ],
  // Its own port and data file, so a running `npm run dev` and its data are left alone.
  webServer: E2E_PRODUCTION
    ? {
        // MEASURE_BUILD=production: the measurement-only production build (AD-31), built with `npm run measure:build`
        command: `npm run reset-dev-data && npx tsx scripts/measure.ts start`,
        url: `${baseURL}/sign-in`,
        env: { INFOMAPPER_DEV_DB: E2E_DB, PORT: String(E2E_PORT) },
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : {
        // The server starts before globalSetup, so it seeds its data file itself.
        // a fresh build folder every run: the server is stopped by force at the end, so nothing of the last run is reused
        command: `npx tsx scripts/clean-e2e-build.ts .next-e2e && npm run reset-dev-data && npm run dev -- --port ${E2E_PORT}`,
        url: `${baseURL}/sign-in`,
        // the test hooks (slice 4p) are on in the e2e dev server only
        env: { INFOMAPPER_DEV_DB: E2E_DB, NEXT_DIST_DIR: ".next-e2e", INFOMAPPER_TEST_HOOKS: "1" },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
