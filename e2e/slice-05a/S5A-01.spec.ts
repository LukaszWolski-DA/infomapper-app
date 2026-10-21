// S5A-01 (slice 5a, PRD items 1–2): each toolbar button hides and shows its panel, `aria-pressed` follows, the canvas
// takes the width; both hidden at once. A hidden panel stays in the page but is inert: Tab never reaches it and it is
// out of the accessibility tree (Łukasz's answer 5).

import { expect, test } from "./fixtures";
import { box, canvasArea, expectCanvasWidth, expectHidden, expectShown, openCanvas, panel, signInAs, toggle, togglePanel } from "./helpers";

test("S5A-01: the toolbar buttons hide and show the panels; the canvas takes the width; both can be hidden", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  await expect(toggle(page, "left")).toHaveAttribute("title", "Show or hide the object browser");
  await expect(toggle(page, "right")).toHaveAttribute("title", "Show or hide the details panel");
  await expectShown(page, "left");
  await expectShown(page, "right");
  const full = (await box(canvasArea(page))).width;
  const viewport = page.viewportSize()!.width;

  await togglePanel(page, "left");
  await expectHidden(page, "left");
  await expectCanvasWidth(page, full + 264);
  await togglePanel(page, "right");
  await expectHidden(page, "right");
  await expectCanvasWidth(page, viewport); // both hidden: the canvas takes the whole window
  expect((await box(canvasArea(page))).x).toBeLessThanOrEqual(1);

  await togglePanel(page, "left");
  await expectShown(page, "left");
  await expectCanvasWidth(page, full + 340);
  await togglePanel(page, "right");
  await expectShown(page, "right");
  await expectCanvasWidth(page, full);
});

test("S5A-01: a hidden panel is inert: out of Tab's reach and of the accessibility tree", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page);
  // shown, the left panel's tabs and buttons are reachable
  await expect(panel(page, "left").getByRole("button").first()).toBeVisible();
  await togglePanel(page, "left");
  await togglePanel(page, "right");
  await expectHidden(page, "left");
  await expectHidden(page, "right");
  await expect(panel(page, "left").getByRole("button")).toHaveCount(0);
  await expect(panel(page, "right").getByRole("button")).toHaveCount(0);
  const snapshot = await page.locator("body").ariaSnapshot();
  expect(snapshot).not.toContain("Collapse all groups");

  // Tab from the left button walks the whole page without entering either panel
  await toggle(page, "left").focus();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => !!document.activeElement?.closest('[data-testid="panel-left"], [data-testid="panel-inspector"]'));
    expect(inside, `Tab ${i + 1}`).toBe(false);
  }
});
