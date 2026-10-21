// S5A-06 (slice 5a, PRD items 12–13, Łukasz's answer 3): on a narrow screen (a 1000 px wide window) both panels start
// hidden and the canvas has the whole width; a toolbar button slides its panel over the canvas, one at a time, and the
// canvas keeps its width. A selection does not open the details panel; clicking an entity in the left panel closes
// it. The remembered layout applies again above 1000 px. No grips on a narrow screen.

import { expect, test } from "./fixtures";
import { box, canvasArea, card, expectCanvasWidth, expectHidden, openCanvas, panel, signInAs, toggle, togglePanel, treeItem } from "./helpers";

test.use({ viewport: { width: 1000, height: 720 } });

test("S5A-06: narrow screen: panels hidden, slid over the canvas one at a time, the canvas keeps its width", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, undefined, { x: 0, y: 0, zoom: 0.6 });
  await expectHidden(page, "left");
  await expectHidden(page, "right");
  await expectCanvasWidth(page, 1000);
  // both buttons lie inside the window (the bar's tools are cut off first)
  for (const side of ["left", "right"] as const) {
    const b = await box(toggle(page, side));
    expect(b.x, side).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, side).toBeLessThanOrEqual(1000);
  }
  expect(await page.getByTestId("bar-top").evaluate((el) => el.scrollLeft)).toBe(0);

  await togglePanel(page, "left");
  await expect(panel(page, "left")).toBeVisible();
  await expect(panel(page, "left")).not.toHaveAttribute("inert");
  await expect(page.getByTestId("grip-left")).toBeHidden();
  const left = await box(panel(page, "left"));
  expect(left.x).toBeLessThanOrEqual(1);
  expect(Math.round(left.width)).toBe(300);
  await expectCanvasWidth(page, 1000);

  // the other button: its panel slides in, the first one goes
  await togglePanel(page, "right");
  await expect(panel(page, "right")).toBeVisible();
  await expectHidden(page, "left");
  const right = await box(panel(page, "right"));
  expect(Math.round(right.x + right.width)).toBe(1000);
  expect(Math.round(right.width)).toBe(300);
  await expect(panel(page, "right")).toHaveCSS("box-shadow", /rgba?\(/);
  await expect(page.getByTestId("grip-right")).toBeHidden();
  await expectCanvasWidth(page, 1000);
  // the same button closes it
  await togglePanel(page, "right");
  await expectHidden(page, "right");
});

test("S5A-06: narrow screen: a selection does not open the details panel; an entity's click closes the left panel", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, undefined, { x: 0, y: 0, zoom: 0.6 });
  await card(page, "Customer").locator(".c-head").click({ position: { x: 20, y: 10 } });
  await expectHidden(page, "right");

  await togglePanel(page, "left");
  await treeItem(page, "Sales Order").click();
  await expectHidden(page, "left");
  await expectHidden(page, "right");
});

test("S5A-06: the remembered layout applies only above 1000 px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await togglePanel(page, "right"); // remembered: right hidden
  await page.setViewportSize({ width: 1000, height: 720 });
  await expectHidden(page, "left");
  await expectHidden(page, "right");
  await togglePanel(page, "left");
  await expect(panel(page, "left")).toBeVisible();
  // the narrow overlay is not remembered, and crossing 1000 px closes it
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(toggle(page, "left")).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page, "left")).toBeVisible();
  await expectHidden(page, "right");
  await expectCanvasWidth(page, 1280 - 264);
  await page.setViewportSize({ width: 1000, height: 720 });
  await expectHidden(page, "left");
  expect((await box(canvasArea(page))).width).toBeGreaterThan(999);
});
