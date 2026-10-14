// Slice 4p, trial A (step 1): the hover and the selection marks are drawn in one overlay above the cards with its own
// compositing layer. Guards (dev server, where the canvas and the Overview's miniature count their commits): a hover and
// a lasso being drawn re-render neither the canvas nor the miniature; the hovered lines are drawn in the overlay, above
// the cards. Becomes part of S4P-12's test at step 5 if trial A is adopted.

import { expect, test } from "../slice-02a/fixtures";
import { canvasUrl, openCanvas, rowNamed, screenPoint, signInAs, WHOLE } from "../slice-02a/helpers";
import type { Page } from "../slice-02a/fixtures";

const counters = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __imCanvasCommits?: number; __imMiniatureCommits?: number };
    return { canvas: w.__imCanvasCommits ?? 0, miniature: w.__imMiniatureCommits ?? 0 };
  });

test("S4P trial A (guard): the hover and a lasso being drawn are in the overlay layer above the cards and re-render neither the canvas nor the Overview's miniature", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  const overlay = page.getByTestId("layer-overlay");
  // one container with a compositing layer of its own, after the cards in the viewport
  expect(await overlay.evaluate((el) => getComputedStyle(el).willChange)).toBe("transform");
  expect(await overlay.evaluate((el) => !!(document.querySelector(".react-flow__nodes")!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.waitForTimeout(1500);
  const before = await counters(page);
  expect(before.canvas).toBeGreaterThan(0); // the counters work
  expect(before.miniature).toBeGreaterThan(0);

  // hover Customer.email: its two lines drawn again in the overlay, three rows marked, the row's two dots
  const row = (await rowNamed(page, "Customer", "email").boundingBox())!;
  await page.mouse.move(row.x + 40, row.y + row.height / 2);
  await expect(overlay.getByTestId("hover-row")).toHaveCount(3);
  await expect(overlay.getByTestId("layer-hover-lines").locator('[data-testid="line-mapping"]')).toHaveCount(2);
  await expect(page.locator(".react-flow__edgelabel-renderer [data-testid='layer-hover-lines']")).toHaveCount(0);
  await page.mouse.move(row.x + 40, row.y + row.height / 2 + 26); // the next row
  await page.mouse.move(row.x - 300, row.y - 300);
  await expect(overlay.getByTestId("hover-row")).toHaveCount(0);
  expect(await counters(page), "commits after hovering").toEqual(before);

  // a lasso being drawn: its rectangle in the overlay, no commit until the release selects
  const a = await screenPoint(page, { x: 470, y: 8 }), b = await screenPoint(page, { x: 900, y: 840 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
  await expect(overlay.getByTestId("lasso")).toHaveCount(1);
  expect(await counters(page), "commits while drawing a lasso").toEqual(before);
  await page.mouse.up();
  await expect(overlay.getByTestId("mark-selected")).toHaveCount(2);
  // selecting re-renders the canvas (as before), never the miniature
  expect((await counters(page)).miniature, "miniature commits after the lasso").toBe(before.miniature);
});
