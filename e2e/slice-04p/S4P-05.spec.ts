// S4P-05 (slice 4p, trial A adopted; AD-24): the hover is drawn in one overlay above the cards with its own compositing
// layer: the hovered row's lines drawn again there (above the cards), the rows at their other ends marked, and nothing
// re-renders the canvas or the Overview's miniature while hovering (dev server, where both count their commits). C-10's
// time itself is measured by S1B-10 with MEASURE=1 (`npm run measure:canvas`).

import { expect, test } from "../slice-02a/fixtures";
import { canvasUrl, openCanvas, rowNamed, signInAs, WHOLE } from "../slice-02a/helpers";
import { counters } from "./helpers";

test("S4P-05: the hover is drawn in the overlay above the cards, on its own compositing layer, and re-renders neither the canvas nor the Overview's miniature", async ({ page }) => {
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

  // hover Customer.email: its two lines drawn again in the overlay, three rows marked
  const row = (await rowNamed(page, "Customer", "email").boundingBox())!;
  await page.mouse.move(row.x + 40, row.y + row.height / 2);
  await expect(overlay.getByTestId("hover-row")).toHaveCount(3);
  await expect(overlay.getByTestId("layer-hover-lines").locator('[data-testid="line-mapping"]')).toHaveCount(2);
  await expect(page.locator(".react-flow__edgelabel-renderer [data-testid='layer-hover-lines']")).toHaveCount(0);
  await page.mouse.move(row.x + 40, row.y + row.height / 2 + 26); // the next row
  await page.mouse.move(row.x - 300, row.y - 300);
  await expect(overlay.getByTestId("hover-row")).toHaveCount(0);
  expect(await counters(page), "commits after hovering").toEqual(before);
});
