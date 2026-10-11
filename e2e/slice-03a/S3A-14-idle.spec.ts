// S3A-14 is a measurement round (docs/prd/slice-03a-acceptance.md). This spec is a guard beside S2C-12: in step 3 a
// note drawn below 40 % zoom took its plain body's height from its own last measure and was measured again, so every
// note grew by 8 px about once a second and the canvas re-rendered while nobody touched it. With the demo's notes on
// the canvas below 40 %, frames expanded and collapsed, nothing may commit while idle and no note may change its size.

import { expect, test, type Page } from "./fixtures";
import { AROUND, canvasUrl, collapsedFrame, makeFrame, openCanvas, signInAs } from "../slice-02c/helpers";

const commits = (page: Page) => page.evaluate(() => (window as unknown as { __imCanvasCommits?: number }).__imCanvasCommits ?? 0);
const noteSizes = (page: Page) =>
  page.getByTestId("note").evaluateAll((els) => els.map((e) => `${(e as HTMLElement).offsetWidth}x${(e as HTMLElement).offsetHeight}`));

/** Below 40 % zoom, with the whole demo canvas in view. */
const BELOW_40 = { x: 10, y: 10, zoom: 0.3 };

async function expectIdle(page: Page) {
  // the notes draw their plain body at this zoom
  await expect(page.getByTestId("note").first()).toBeVisible();
  await expect(page.locator(".nt-lod").first()).toBeVisible();
  // let the page settle (fonts, measuring), then nothing may commit and no note may grow for three seconds
  await page.waitForTimeout(1500);
  const idle = await commits(page);
  const sizes = await noteSizes(page);
  expect(idle).toBeGreaterThan(0); // the counter works
  await page.waitForTimeout(3000);
  expect(await commits(page), "commits while idle").toBe(idle);
  expect(await noteSizes(page), "note sizes while idle").toEqual(sizes);
}

test("S3A-14 (guard): with notes below 40 % zoom and frames expanded, the canvas does not re-render while idle and no note changes its size", async ({ page }) => {
  await makeFrame(AROUND.customer, { name: "Customer" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), BELOW_40);
  await expect(page.getByTestId("frame")).toHaveCount(1);
  await expectIdle(page);
});

test("S3A-14 (guard): with notes below 40 % zoom and frames collapsed, the canvas does not re-render while idle and no note changes its size", async ({ page }) => {
  // order_line and its pinned notes stay outside the collapsed frames; the free note too
  await collapsedFrame(AROUND.tables, { name: "Tables" });
  await collapsedFrame(AROUND.customer, { name: "Customer" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), BELOW_40);
  await expect(page.getByTestId("block")).toHaveCount(2);
  await expectIdle(page);
});
