import { defineConfig } from "@playwright/test";

/*
 * Functional checks (C-03, C-05, C-06, C-07) run headless.
 * Measurements (measure.spec.ts) run in installed Google Chrome, headed, so the GPU is used as on a real laptop.
 * Both run against a production build on port 3101.
 */
const PORT = 3101;

export default defineConfig({
  testDir: "./tests",
  timeout: 180_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1536, height: 864 }, // 1920×1080 at 125 % scaling, the usual business-laptop setting
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: [
    { name: "functional", testIgnore: /measure\.spec\.ts/, use: { browserName: "chromium" } },
    {
      name: "measure",
      testMatch: /measure\.spec\.ts/,
      use: { browserName: "chromium", channel: "chrome", headless: false },
    },
  ],
});
