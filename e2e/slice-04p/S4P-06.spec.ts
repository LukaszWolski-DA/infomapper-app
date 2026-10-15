// S4P-06 (slice 4p, trial A adopted; AD-24): the lasso and the selection marks are drawn in the overlay above the cards
// with its own compositing layer; drawing a lasso re-renders neither the canvas nor the Overview's miniature, and the
// selection it makes at the release re-renders the canvas once, as before, never the miniature (dev server). The marks'
// time is measured by S2A-14 with MEASURE=1 (`npm run measure:canvas`).

import { expect, test } from "../slice-02a/fixtures";
import { canvasUrl, openCanvas, screenPoint, signInAs, WHOLE } from "../slice-02a/helpers";
import { counters } from "./helpers";

test("S4P-06: a lasso being drawn and the selection marks are in the overlay; drawing re-renders neither the canvas nor the miniature", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  const overlay = page.getByTestId("layer-overlay");
  await page.waitForTimeout(1500);
  const before = await counters(page);
  expect(before.canvas).toBeGreaterThan(0);

  const a = await screenPoint(page, { x: 470, y: 8 }), b = await screenPoint(page, { x: 900, y: 840 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
  await expect(overlay.getByTestId("lasso")).toHaveCount(1);
  expect(await counters(page), "commits while drawing a lasso").toEqual(before);
  await page.mouse.up();
  await expect(overlay.getByTestId("mark-selected")).toHaveCount(2);
  await expect(overlay.getByTestId("box-selection")).toHaveCount(1);
  expect((await counters(page)).miniature, "miniature commits after the lasso").toBe(before.miniature);
});
