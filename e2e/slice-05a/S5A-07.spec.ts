// S5A-07 (slice 5a, Łukasz's answer 2): hiding and showing a panel resize the canvas without a canvas commit and
// without a miniature commit (`__imCanvasCommits`, `__imMiniatureCommits`; the canvas no longer re-renders on a size
// change). The first view after a load is still placed for the canvas's real size: a remembered view exactly, and a
// fitted one inside the canvas, with a panel hidden. No commit while a grip is dragged, and none on its release, its
// double-click or its keyboard.

import { expect, test } from "./fixtures";
import { SEED_IDS, box, canvasArea, cardNodes, commitCounters, dragGrip, expectCanvasWidth, grip, openCanvas, panelWidth, signInAs, togglePanel, viewportTransform } from "./helpers";

test("S5A-07: hiding and showing either panel add no canvas commit and no miniature commit", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, undefined, { x: 40, y: 30, zoom: 0.8 });
  await page.waitForTimeout(500);
  const width = (await box(canvasArea(page))).width;
  const before = await commitCounters(page);

  await togglePanel(page, "left");
  await expectCanvasWidth(page, width + 264);
  await togglePanel(page, "right");
  await expectCanvasWidth(page, width + 264 + 340);
  await togglePanel(page, "left");
  await togglePanel(page, "right");
  await expectCanvasWidth(page, width);
  await page.waitForTimeout(500);

  const after = await commitCounters(page);
  expect(after.canvas - before.canvas, "canvas commits").toBe(0);
  expect(after.miniature - before.miniature, "miniature commits").toBe(0);
});

test("S5A-07: the first view after a load is placed for the canvas's real size, with a panel hidden", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await togglePanel(page, "left");

  // a remembered view: exactly as stored
  const view = { x: 120, y: 45, zoom: 0.7 };
  await openCanvas(page, undefined, view);
  const t = await viewportTransform(page);
  expect(t.x).toBeCloseTo(view.x, 0);
  expect(t.y).toBeCloseTo(view.y, 0);
  expect(t.zoom).toBeCloseTo(view.zoom, 3);

  // no remembered view: fitted into the whole canvas, which starts at the window's left edge
  await page.evaluate((id) => localStorage.removeItem(`infomapper:view:${id}`), SEED_IDS.canvasCustomerOrders);
  await openCanvas(page);
  const area = await box(canvasArea(page));
  expect(area.x).toBeLessThanOrEqual(1);
  const boxes = await cardNodes(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
  expect(boxes.length).toBeGreaterThan(0);
  const left = Math.min(...boxes.map((b) => b.left)), right = Math.max(...boxes.map((b) => b.right));
  expect(left).toBeGreaterThanOrEqual(area.x);
  expect(right).toBeLessThanOrEqual(area.x + area.width);
  // the same view a fit gives now, at the canvas's real size (F, as the toolbar's “Fit”)
  const first = await viewportTransform(page);
  await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("f");
  await page.waitForTimeout(600); // the fit's 250 ms animation
  const fitted = await viewportTransform(page);
  expect(Math.abs(fitted.x - first.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(fitted.y - first.y)).toBeLessThanOrEqual(1);
  expect(fitted.zoom).toBeCloseTo(first.zoom, 3);
});

test("S5A-07: dragging a grip adds no canvas or miniature commit; nor do the release, a double-click and the keyboard", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, undefined, { x: 40, y: 30, zoom: 0.8 });
  await page.waitForTimeout(500);
  const before = await commitCounters(page);

  await dragGrip(page, "left", 150, async () => {
    const during = await commitCounters(page);
    expect(during.canvas - before.canvas, "canvas commits while dragging").toBe(0);
    expect(during.miniature - before.miniature, "miniature commits while dragging").toBe(0);
  });
  await expect.poll(() => panelWidth(page, "left")).toBe(414);
  await dragGrip(page, "right", -100);
  await expect.poll(() => panelWidth(page, "right")).toBe(440);
  await grip(page, "left").dblclick();
  await expect.poll(() => panelWidth(page, "left")).toBe(264);
  await grip(page, "right").focus();
  await page.keyboard.press("Home");
  await expect.poll(() => panelWidth(page, "right")).toBe(340);
  await page.waitForTimeout(500);

  const after = await commitCounters(page);
  expect(after.canvas - before.canvas, "canvas commits").toBe(0);
  expect(after.miniature - before.miniature, "miniature commits").toBe(0);
});
