// S5A-03 (slice 5a, PRD item 6): no jump. A card stays where it is on the screen (±1 px) when the left panel is hidden
// and shown, when the left panel is resized by its grip, its keyboard or a double-click; hiding or resizing the right
// panel does not move it either.

import { expect, test } from "./fixtures";
import { cardAt, dragGrip, expectCanvasWidth, expectCardAt, grip, openCanvas, panelWidth, signInAs, togglePanel, box, canvasArea } from "./helpers";

for (const view of [{ x: 40, y: 30, zoom: 1 }, { x: 10, y: 10, zoom: 0.35 }]) {
  test(`S5A-03: hiding and showing a panel keeps the model in place on the screen (zoom ${view.zoom})`, async ({ page }) => {
    await signInAs(page, "Łukasz");
    await openCanvas(page, undefined, view);
    const at = await cardAt(page, "Customer");
    const width = (await box(canvasArea(page))).width;

    await togglePanel(page, "left");
    await expectCanvasWidth(page, width + 264);
    await expectCardAt(page, "Customer", at);
    await togglePanel(page, "left");
    await expectCanvasWidth(page, width);
    await expectCardAt(page, "Customer", at);

    await togglePanel(page, "right");
    await expectCanvasWidth(page, width + 340);
    await expectCardAt(page, "Customer", at);
    await togglePanel(page, "left");
    await expectCanvasWidth(page, width + 340 + 264);
    await expectCardAt(page, "Customer", at);
    await togglePanel(page, "right");
    await togglePanel(page, "left");
    await expectCanvasWidth(page, width);
    await expectCardAt(page, "Customer", at);
  });
}

test("S5A-03: resizing the left panel (drag, keyboard, double-click) keeps the model in place; so does the right one", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, undefined, { x: 40, y: 30, zoom: 0.8 });
  const at = await cardAt(page, "Customer");

  await dragGrip(page, "left", 120);
  await expect.poll(() => panelWidth(page, "left")).toBe(384);
  await expectCardAt(page, "Customer", at);
  await grip(page, "left").dblclick();
  await expect.poll(() => panelWidth(page, "left")).toBe(264);
  await expectCardAt(page, "Customer", at);
  await grip(page, "left").focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await expect.poll(() => panelWidth(page, "left")).toBe(200);
  await expectCardAt(page, "Customer", at);
  await page.keyboard.press("Home");
  await expect.poll(() => panelWidth(page, "left")).toBe(264);
  await expectCardAt(page, "Customer", at);

  await dragGrip(page, "right", -150);
  await expect.poll(() => panelWidth(page, "right")).toBe(490);
  await expectCardAt(page, "Customer", at);
  // and with the left panel hidden and shown again at its new width
  await dragGrip(page, "left", 64);
  await togglePanel(page, "left");
  await expectCardAt(page, "Customer", at);
  await togglePanel(page, "left");
  await expect.poll(() => panelWidth(page, "left")).toBe(328);
  await expectCardAt(page, "Customer", at);
});
