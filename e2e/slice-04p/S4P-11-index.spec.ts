// S4P-11 (slice 4p, item 10): the requirement index's build time in the browser, in the measurement build (MEASURE=1
// MEASURE_BUILD=production; the normal run leaves it out). Through the measuring hook `window.__imIndexTiming`: 30 builds
// after three warm-up builds, on the page's own data (“Customer & orders” of Retail Co, and “Performance test”) and on
// slice 4a's synthetic model (500 requirements, 5,000 attributes, 2,000 mappings, 3,000 links), each three times.
// Above 50 ms per build, slice 4b needs an incremental rebuild (PRD item 10). Results in test-results/S4P-11.json.

import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { expect, test, type Page } from "../slice-01a/fixtures";
import { canvasUrl, openCanvas, signInAs } from "../slice-01a/helpers";
import { MEASURE_USE, saveResults } from "../slice-01b/measure";

test.use(MEASURE_USE);

const time = (page: Page, which: "page" | "synthetic") => page.evaluate((w) => (window as unknown as { __imIndexTiming: (w: string) => Promise<unknown> }).__imIndexTiming(w), which);

test("S4P-11: the requirement index's build time in the browser, demo data and the synthetic model", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(300_000);
  await seedLargeData(E2E_DB);
  await signInAs(page, "Łukasz");
  const results: Record<string, unknown[]> = { "Customer & orders": [], "Performance test": [], synthetic: [] };
  await openCanvas(page, canvasUrl());
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) results["Customer & orders"]!.push(await time(page, "page"));
  for (let i = 0; i < 3; i++) results.synthetic!.push(await time(page, "synthetic"));
  await openCanvas(page, canvasUrl(LARGE_IDS.canvas, LARGE_IDS.project, LARGE_IDS.workspace));
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) results["Performance test"]!.push(await time(page, "page"));
  for (const runs of Object.values(results)) for (const r of runs) expect(r).not.toHaveProperty("error");
  saveResults("S4P-11", { browser: browser.version(), ...results });
});
