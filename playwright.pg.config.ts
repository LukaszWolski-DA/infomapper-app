// The smoke set on Postgres (slice 29, Q8, S29-05, S29-06): e2e/slice-29 only, never part of the full run (which stays
// on the local adapter, e2e/parts.ts). It never touches .data/.
//
// - Locally (environment 2): against a running `npm run dev:pg` on http://localhost:3000 (PG_BASE_URL to change it); the
//   values come from `.env.postgres.local` (git-ignored, L4).
// - In CI (the Schema workflow's smoke job): against a production build (`next start`, INFOMAPPER_DATA=postgres) on
//   Supabase's local stack, started here when PG_SERVE=1. CI never connects to infomapper-dev.
import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { loadPgEnv } from "./scripts/lib/pg-env";

if (!process.env.CI && fs.existsSync(".env.postgres.local")) loadPgEnv();

const serve = process.env.PG_SERVE === "1";
const PORT = 3400;
const baseURL = process.env.PG_BASE_URL ?? (serve ? `http://127.0.0.1:${PORT}` : "http://localhost:3000");

export default defineConfig({
  testDir: "e2e/slice-29",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-pg" }]],
  outputDir: "test-results/pg",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(serve
    ? {
        webServer: {
          command: `npx next start -p ${PORT} -H 127.0.0.1`,
          url: baseURL,
          timeout: 120_000,
          reuseExistingServer: false,
          env: { INFOMAPPER_DATA: "postgres" },
        },
      }
    : {}),
});
