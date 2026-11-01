// S12B-10 (slice 12b, PRD items 1–2 and section 6; step 1, F11): the load of the project home and the workspace home,
// measurement build only (MEASURE=1 MEASURE_BUILD=production; the normal e2e run leaves this file out). Three data
// sets in one sitting: the seed (Order management, Retail Co – DWH), "Performance test" (`seedLargeData`: its project
// with "100 cards" and the requirements canvas, its workspace) and "Performance test – 20 canvases" (`addManyCanvases`,
// written into the e2e data file only; its project, and the workspace with now two projects). Per page: 2 loads
// discarded, then LOADS; the navigation timing (TTFB = responseStart − requestStart, responseEnd, DOMContentLoaded,
// load), FCP, LCP (a buffered observer) and the document's size (decoded, as transferred); median and p95. Results in
// test-results/S12B-10.json (or S12B-10-<LABEL>.json, LABEL=...) and a copy in .data/measure/s12b10/, to run the same spec
// on another branch for the A/B (step 5). LOADS=<n> changes the number of loads; SAVE_HTML=<folder> keeps each document.

import fs from "node:fs";
import path from "node:path";
import { seedLargeData } from "../../src/data/local/dev-data";
import { LARGE_IDS } from "../../src/data/local/seed-large";
import { SEED_IDS } from "../../src/data/local/seed";
import { addManyCanvases, MANY_PROJECT_ID } from "../../scripts/lib/many-canvases";
import { E2E_DB, E2E_PRODUCTION } from "../config";
import { MEASURE, MEASURE_USE, saveResults } from "../slice-01b/measure";
import { signInAs } from "../slice-00/helpers";
import { expect, test, type Page } from "./fixtures";

test.use(MEASURE_USE);

const LOADS = Number(process.env.LOADS ?? 15);
const WARM_UP = 2;
const LABEL = process.env.LABEL ? `-${process.env.LABEL}` : "";

interface Load {
  ttfb: number;
  responseEnd: number;
  dcl: number;
  load: number;
  fcp: number;
  lcp: number;
  decoded: number;
  transferred: number;
}

const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const p95 = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(xs.length * 0.95) - 1)]!;

async function loadOnce(page: Page, url: string, ready: string): Promise<Load> {
  await page.goto(url, { waitUntil: "load" });
  await expect(page.getByTestId(ready)).toBeVisible();
  // LCP is final once the page has painted and nothing larger comes; a short pause, then read the buffered entries
  await page.waitForTimeout(400);
  return page.evaluate(
    () =>
      new Promise<Load>((resolve) => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? NaN;
        let lcp = NaN;
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) lcp = e.startTime;
        });
        obs.observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => {
          obs.disconnect();
          const r = (v: number) => +v.toFixed(1);
          resolve({
            ttfb: r(nav.responseStart - nav.requestStart),
            responseEnd: r(nav.responseEnd),
            dcl: r(nav.domContentLoadedEventEnd),
            load: r(nav.loadEventEnd),
            fcp: r(fcp),
            lcp: r(lcp),
            decoded: nav.decodedBodySize,
            transferred: nav.transferSize,
          });
        }, 50);
      }),
  );
}

async function measurePage(page: Page, url: string, ready: string) {
  for (let i = 0; i < WARM_UP; i++) await loadOnce(page, url, ready);
  const loads: Load[] = [];
  for (let i = 0; i < LOADS; i++) loads.push(await loadOnce(page, url, ready));
  const keys = Object.keys(loads[0]!) as (keyof Load)[];
  const summary = Object.fromEntries(keys.map((k) => [k, { median: median(loads.map((l) => l[k])), p95: p95(loads.map((l) => l[k])) }]));
  // SAVE_HTML=<folder>: the document as the server sent it, to see what its bytes are (diagnosis only)
  if (process.env.SAVE_HTML) {
    fs.mkdirSync(process.env.SAVE_HTML, { recursive: true });
    fs.writeFileSync(path.join(process.env.SAVE_HTML, `${url.replace(/[^a-z0-9]+/gi, "_")}.html`), await (await page.request.get(url)).text());
  }
  return { url, loads: loads.length, summary, raw: loads };
}

test("S12B-10: the home pages' load on the seed, “Performance test” and its 20-canvas project", async ({ page, browser }) => {
  expect(E2E_PRODUCTION, "measurement build only (MEASURE_BUILD=production)").toBe(true);
  test.setTimeout(30 * 60_000);
  await signInAs(page, "Łukasz");
  const project = (ws: string, p: string) => `/w/${ws}/p/${p}`;
  const results: Record<string, unknown> = {};

  // the seed (the fixture has reset the e2e data file)
  results["seed / project home (Order management)"] = await measurePage(page, project(SEED_IDS.wsRetailDwh, SEED_IDS.projOrderManagement), "page-project-home");
  results["seed / workspace home (Retail Co – DWH)"] = await measurePage(page, `/w/${SEED_IDS.wsRetailDwh}`, "page-workspace-home");

  // "Performance test"
  await seedLargeData(E2E_DB);
  results["large / project home (Performance test)"] = await measurePage(page, project(LARGE_IDS.workspace, LARGE_IDS.project), "page-project-home");
  results["large / workspace home (Performance test, 1 project)"] = await measurePage(page, `/w/${LARGE_IDS.workspace}`, "page-workspace-home");

  // "Performance test – 20 canvases": a project of its own, in the e2e data file only
  await addManyCanvases(E2E_DB);
  results["many / project home (20 canvases)"] = await measurePage(page, project(LARGE_IDS.workspace, MANY_PROJECT_ID), "page-project-home");
  results["many / workspace home (Performance test, 2 projects)"] = await measurePage(page, `/w/${LARGE_IDS.workspace}`, "page-workspace-home");
  results["many / project home (Performance test, again)"] = await measurePage(page, project(LARGE_IDS.workspace, LARGE_IDS.project), "page-project-home");

  const out = { measured: MEASURE, browser: browser.version(), loads: LOADS, warmUp: WARM_UP, results };
  saveResults(`S12B-10${LABEL}`, out);
  // Playwright empties test-results/ at the start of every run: a sitting of several runs keeps each one here too
  const kept = path.resolve(".data", "measure", "s12b10", `S12B-10${LABEL}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(kept), { recursive: true });
  fs.writeFileSync(kept, JSON.stringify(out, null, 2));
});
