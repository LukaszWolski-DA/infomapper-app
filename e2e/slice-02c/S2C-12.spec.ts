// S2C-12 is a measurement round (docs/prd/slice-02c-acceptance.md). This spec is its guard: in slice 2c a render loop
// re-rendered a canvas with a collapsed frame on every frame, also with nobody touching it, which cost the collapsed
// canvas about a third of its pan and zoom frames. In development the canvas counts its commits
// (`window.__imCanvasCommits`); with a frame collapsed, nothing may re-render it while the mouse and keys are still,
// nor while the view is panned and zoomed.

import { expect, test } from "./fixtures";
import { AROUND, blockEl, canvasUrl, collapsedFrame, openCanvas, paneMiddle, signInAs, FRAMED } from "./helpers";
import type { Page } from "./fixtures";

const commits = (page: Page) => page.evaluate(() => (window as unknown as { __imCanvasCommits?: number }).__imCanvasCommits ?? 0);

test("S2C-12 (guard): with a frame collapsed the canvas does not re-render while nobody touches it, nor while the view pans and zooms", async ({ page }) => {
  await collapsedFrame(AROUND.tables, { name: "Tables" });
  await collapsedFrame(AROUND.customer, { name: "Customer" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await expect(page.getByTestId("block")).toHaveCount(2);
  await expect(blockEl(page, "Tables")).toBeVisible();
  // let the page settle (fonts, measuring), then nothing may commit for a second and a half
  await page.waitForTimeout(1500);
  const idle = await commits(page);
  expect(idle).toBeGreaterThan(0); // the counter works
  await page.waitForTimeout(1500);
  expect(await commits(page), "commits while idle").toBe(idle);

  // panning and zooming move React Flow's viewport only
  const mid = await paneMiddle(page);
  await page.mouse.move(mid.x, mid.y);
  for (let i = 0; i < 10; i++) await page.mouse.wheel(20, 10);
  await page.keyboard.down("Control");
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -20);
  await page.keyboard.up("Control");
  await page.waitForTimeout(500);
  expect(await commits(page), "commits while panning and zooming").toBe(idle);
});
