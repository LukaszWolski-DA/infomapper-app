// S35-03's timing (slice 35, PRD "Tests": "one spec times creating a baseline on the demo"): taking a baseline of the
// demo's "Retail Co – DWH" in the page, from the click to the list showing it, five times; and the home's load with five
// baselines against none. Reference figures in the report (no bar but S35-03's "a few seconds at most": 5 s each).
import { test, expect } from "./fixtures";
import { createInBox, expectToast, openBaselines, rows, signInAs } from "./helpers";

test.use({ seed: "full" });

test("S35-timing: taking a baseline on the demo, and the home's load with baselines", async ({ page }, info) => {
  await signInAs(page, "Łukasz");
  await page.goto("/w/01a0f9e9-2007-7148-89de-52f53405ecb8");
  const homeNone = await loadTime(page);
  await openBaselines(page);
  const takes: number[] = [];
  for (let i = 1; i <= 5; i++) {
    const started = Date.now();
    await createInBox(page, `Timing ${i}`);
    await expect(rows(page).first().getByTestId("baseline-name")).toHaveText(`Timing ${i}`);
    takes.push(Date.now() - started);
    await expectToast(page, `Created the baseline Timing ${i}.`);
  }
  await page.goto("/w/01a0f9e9-2007-7148-89de-52f53405ecb8");
  const homeSix = await loadTime(page);
  const sorted = [...takes].sort((a, b) => a - b);
  const figures = { takesMs: takes, medianMs: sorted[2], homeLoadMs: { withOneBaseline: homeNone, withSixBaselines: homeSix } };
  console.log(`S35-timing: ${JSON.stringify(figures)}`);
  await info.attach("timing.json", { body: JSON.stringify(figures, null, 2), contentType: "application/json" });
  for (const t of takes) expect(t).toBeLessThan(5_000);
});

/** The home's document load, from navigation start to load end, after a reload (median of three). */
async function loadTime(page: import("@playwright/test").Page): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await expect(page.getByTestId("tab-baselines")).toBeVisible();
    times.push(await page.evaluate(() => Math.round((performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).loadEventEnd)));
  }
  return times.sort((a, b) => a - b)[1]!;
}
