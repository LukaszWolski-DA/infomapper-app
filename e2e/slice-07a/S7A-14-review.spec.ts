// S7A-14, the review part (slice 7a, PRD section 6: switching filters in the review of a large file ≤ 200 ms). The
// measurement build only (MEASURE=1 MEASURE_BUILD=production, after `npm run measure:build`), like the other measuring
// specs. Measured in the page: from the filter's click to the second animation frame after it (the click's render is
// done when the click returns; the second frame is after the browser painted it). Not slice 4b-1's traced method; the
// result says which it is. Two files: a first import of 20,000 columns (2,000 new tables, about 2,000 relationships)
// and a re-import of it with 5 % changed, renamed or missing.

import { fivePercent, syntheticStandard } from "../../scripts/lib/import-synthetic";
import { MEASURE, MEASURE_USE, saveResults } from "../slice-01b/measure";
import { expect, test } from "./fixtures";
import { giveFile, importNow, next, openWizard, target } from "./helpers";

test.use(MEASURE ? MEASURE_USE : {});

const FILTERS = ["new", "all", "changed", "missing", "rel", "all"] as const;
const ROUNDS = 5;

async function switchTimes(page: import("@playwright/test").Page) {
  const times: Record<string, number[]> = {};
  for (let round = 0; round < ROUNDS + 1; round++) {
    for (const f of FILTERS) {
      const ms = await page.evaluate(async (id) => {
        const button = document.querySelector<HTMLButtonElement>(`[data-testid="filter-${id}"]`)!;
        const t = performance.now();
        button.click();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return performance.now() - t;
      }, f);
      if (round > 0) (times[f] ??= []).push(ms); // round 0 warms up
    }
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  return Object.fromEntries(Object.entries(times).map(([f, xs]) => [f, { median: Math.round(median(xs)), max: Math.round(Math.max(...xs)) }]));
}

test("S7A-14 (review): switching filters in the review of 20,000 columns", async ({ page }) => {
  test.setTimeout(600_000);
  const tables = 2_000;
  await openWizard(page);
  await target(page, { new: "Synth" });
  await giveFile(page, "import-file", "synthetic.csv", syntheticStandard(tables));
  await next(page);
  await next(page);
  await expect(page.getByTestId("review-table").first()).toBeVisible();
  const first = await switchTimes(page);
  await importNow(page, /^Imported into Synth: /);

  await page.getByTestId("button-import-sources").click();
  await target(page, { existing: "Synth" });
  await giveFile(page, "import-file", "synthetic-changed.csv", syntheticStandard(tables, undefined, fivePercent));
  await next(page);
  await next(page);
  await expect(page.getByTestId("review-table").first()).toBeVisible();
  const again = await switchTimes(page);
  const results = { method: "in-page, click to the second frame (not traced)", measured: MEASURE, first, again };
  saveResults("S7A-14-review", results);
  console.log(JSON.stringify(results, null, 2));
  for (const r of [...Object.values(first), ...Object.values(again)]) expect(r.median).toBeLessThanOrEqual(MEASURE ? 200 : 2_000);
});
