// S16-09 (slice 16, item 6): the canvas stores its remembered view (`infomapper:view:<canvas id>`, D-54) at once after
// its own view changes, with the left edge of that moment: after the first view on open, after hiding the left panel and
// after a fit, read without waiting for React Flow's 150 ms timer. The known limitation's case ("The canvas saves its
// view about 150 ms late"): a window that crosses 1,000 px right after an open, then a reopen, shows the same view.

import { expect, test } from "./fixtures";
import { canvasArea, canvasUrl, cardAt, CO, expectCardAt, expectStoredNow, openCanvas, signInAs, storedView, togglePanel, WHOLE_CO } from "./helpers";

test("S16-09: the open, hiding the left panel and a fit store the view at once, with the left edge of that moment", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expectStoredNow(page, CO); // the first view
  expect((await storedView(page, CO))!.left).toBe(264);

  await togglePanel(page, "left"); // the view moves with the panel (shiftView)
  await expectStoredNow(page, CO);
  expect((await storedView(page, CO))!.left).toBe(0);

  // the fit animates for 250 ms: its target is stored at once, and it is the view shown once it has arrived
  const beforeFit = JSON.stringify(await storedView(page, CO));
  await page.getByTestId("button-zoom-fit").click();
  const target = (await storedView(page, CO))!;
  expect(JSON.stringify(target), "the fit's target stored at the click").not.toBe(beforeFit);
  await page.waitForTimeout(500);
  await expectStoredNow(page, CO);
  const after = (await storedView(page, CO))!;
  expect(Math.abs(after.x - target.x) < 0.5 && Math.abs(after.y - target.y) < 0.5 && Math.abs(after.zoom - target.zoom) < 1e-3, "the view shown is the fit's target").toBe(true);
});

test("S16-09: crossing 1,000 px right after an open, then reopening, shows the model where it stood when its view was stored", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expect(canvasArea(page)).toHaveAttribute("data-ready", "true");
  const atOpen = await cardAt(page, "Customer");
  // no wait for any save: the window crosses 1,000 px at once (the panels slide over the canvas, its left edge is 0)
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(async () => Math.round((await canvasArea(page).boundingBox())!.x)).toBe(0);
  const atNarrow = await cardAt(page, "Customer");
  // React Flow's late timer may come before or after the crossing: either way it stores a view with the left edge of
  // the same moment, never the view of one moment with the left edge of another
  await page.waitForTimeout(400);
  const stored = (await storedView(page, CO))!;
  expect([264, 0], `the stored left edge ${stored.left}`).toContain(stored.left);
  await page.reload();
  await expect(canvasArea(page)).toHaveAttribute("data-ready", "true");
  // the model stands where it stood when that view was stored: at the open (left 264) or after the crossing (left 0)
  await expectCardAt(page, "Customer", stored.left === 264 ? atOpen : atNarrow);
});
