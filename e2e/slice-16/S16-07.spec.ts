// S16-07 (slice 16, item 4): on every platform a right drag pans and opens no toolbox, on an empty canvas and inside a
// frame (S2B-06's case, docs/known-limitations.md "A right-button pan opens the toolbox on Linux and macOS"); a right
// click without moving opens the toolbox once the button comes up; a context menu with no right press (the keyboard's
// menu key) opens it at once, as before.

import { expect, test, type Page } from "./fixtures";
import { canvasUrl, dragBetween, emptyIn, FRAMED, frameNamed, makeFrame, openCanvas, signInAs, viewOf } from "./helpers";

const toolbox = (page: Page) => page.getByTestId("menu-toolbox");

/** An empty spot of the canvas's pane, away from its edges. */
async function emptyCanvasSpot(page: Page) {
  const r = (await page.getByTestId("area-canvas").boundingBox())!;
  const spot = await page.evaluate(
    ({ x0, y0, x1, y1 }) => {
      for (let y = y0 + 80; y < y1 - 40; y += 10) {
        for (let x = x0 + 20; x < x1 - 40; x += 10) {
          if (document.elementFromPoint(x, y)?.classList.contains("react-flow__pane")) return { x, y };
        }
      }
      return null;
    },
    { x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height },
  );
  expect(spot, "an empty spot on the canvas").not.toBeNull();
  return spot!;
}

test("S16-07: a right drag pans without a toolbox, on an empty canvas and inside a frame", async ({ page }) => {
  await makeFrame({ x: 472, y: 0, width: 304, height: 856 }, { name: "Area" }); // Customer and Sales Order
  const start = (await frameNamed("Area"))!;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  for (const where of ["empty canvas", "inside the frame"] as const) {
    const spot = where === "empty canvas" ? await emptyCanvasSpot(page) : await emptyIn(page, "Area");
    const before = await viewOf(page);
    await dragBetween(page, spot, { x: spot.x + 60, y: spot.y + 30 }, { button: "right" });
    await expect.poll(() => viewOf(page), `${where}: the view moved`).not.toBe(before);
    // a toolbox would open on the release at the latest: give it a moment to show
    await page.waitForTimeout(300);
    await expect(toolbox(page), `${where}: no toolbox`).toHaveCount(0);
  }
  expect(await frameNamed("Area")).toMatchObject({ x: start.x, y: start.y }); // the frame did not move
});

test("S16-07: a right click without moving opens the toolbox when the button comes up", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  const spot = await emptyCanvasSpot(page);
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down({ button: "right" });
  await page.waitForTimeout(200);
  // Linux and macOS fire contextmenu here; the toolbox waits for the release (Windows fires it on the release anyway)
  await expect(toolbox(page), "nothing while the button is down").toHaveCount(0);
  await page.mouse.move(spot.x + 2, spot.y + 1); // within the click's slop
  await page.mouse.up({ button: "right" });
  await expect(toolbox(page)).toBeVisible();
  const at = (await toolbox(page).boundingBox())!;
  expect(Math.abs(at.x - (spot.x + 2)) < 40 && Math.abs(at.y - (spot.y + 1)) < 40, `the toolbox opens at the mouse (${at.x}, ${at.y})`).toBe(true);
});

test("S16-07: a context menu with no right press (the keyboard's menu key) opens the toolbox at once", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  const spot = await emptyCanvasSpot(page);
  // what the browser sends for the menu key or Shift+F10 on a focused element inside the canvas: a contextmenu with no
  // right press before it
  await page.evaluate(({ x, y }) => {
    document.elementFromPoint(x, y)!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 0 }));
  }, spot);
  await expect(toolbox(page)).toBeVisible();
});
