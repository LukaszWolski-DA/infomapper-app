// The smoke set on Postgres (slice 29, Q8, S29-05, S29-06): e2e/slice-29 only, never part of the full run (which stays
// on the local adapter, e2e/parts.ts). It never touches .data/.
//
// - Locally (environment 2): against a running `npm run dev:pg` on http://localhost:3000 (PG_BASE_URL to change it); the
//   values come from `.env.postgres.local` (git-ignored, L4).
// - Against the Vercel preview (step 4): PG_BASE_URL=<the preview>; every request carries the Protection Bypass for
//   Automation header (VERCEL_AUTOMATION_BYPASS_SECRET, `.env.postgres.local`), and no trace is recorded, so the secret is
//   in no file.
// - In CI (the Schema workflow's smoke job): against a production build (`next start`, INFOMAPPER_DATA=postgres) on
//   Supabase's local stack, started here when PG_SERVE=1. CI never connects to infomapper-dev.
import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { loadPgEnv } from "./scripts/lib/pg-env";

if (!process.env.CI && fs.existsSync(".env.postgres.local")) loadPgEnv();

const serve = process.env.PG_SERVE === "1";
const PORT = 3400;
const baseURL = process.env.PG_BASE_URL ?? (serve ? `http://127.0.0.1:${PORT}` : "http://localhost:3000");
const onVercel = /.vercel.app$/.test(new URL(baseURL).hostname);
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
if (onVercel && !bypass) throw new Error("VERCEL_AUTOMATION_BYPASS_SECRET is not set: the preview is behind Deployment Protection.");
// slice 31 (Q9): a measurement of the workspace MEASURE_WORKSPACE names records numbers only: no trace, screenshot or
// video, no HTML report (it holds the console's output), whatever the target (`e2e/slice-29/measure-target.ts`)
const ownMeasure = !!process.env.MEASURE_WORKSPACE;
const nothingRecorded = { trace: "off", screenshot: "off", video: "off" } as const;

export default defineConfig({
  testDir: "e2e/slice-29",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: ownMeasure ? [["list"]] : [["list"], ["html", { open: "never", outputFolder: "playwright-report-pg" }]],
  // own mode: a failure's error context holds the page's text, so it stays under the git-ignored .data/
  outputDir: ownMeasure ? ".data/measure/s31/results" : "test-results/pg",
  use: onVercel
    ? { baseURL, trace: "off", ...(ownMeasure ? nothingRecorded : {}), extraHTTPHeaders: { "x-vercel-protection-bypass": bypass!, "x-vercel-set-bypass-cookie": "true" } }
    : { baseURL, ...(ownMeasure ? nothingRecorded : { trace: "retain-on-failure" as const }) },
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
