// S5A-03 (slice 5a, PRD item 6): no jump. A card stays where it is on the screen (±1 px) when the left panel is hidden
// and shown; hiding the right panel does not move it either. Step 3 adds the left resize and the double-click reset.

import { test } from "./fixtures";
import { cardAt, expectCanvasWidth, expectCardAt, openCanvas, signInAs, togglePanel, box, canvasArea } from "./helpers";

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
