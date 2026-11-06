import { expect, test, type Page } from "./fixtures";
import {
  card,
  canvasUrl,
  closeToolbox,
  dragBetween,
  emptyIn,
  frameNamed,
  makeFrame,
  openCanvas,
  screenPoint,
  selectedNames,
  signInAs,
  toolboxLabels,
  viewOf,
  FRAMED,
  zoomOf,
} from "./helpers";

/** The frame "Area" around Customer and Sales Order, on the canvas as Łukasz; its stored row. */
async function openArea(page: Page) {
  await makeFrame({ x: 472, y: 0, width: 304, height: 856 }, { name: "Area" }); // Customer and Sales Order
  const frame = async () => (await frameNamed("Area"))!;
  const start = await frame();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  return { frame, start };
}

/** A pan from an empty spot inside the frame with the right or middle button, or Space + drag; nothing moves, no toolbox. */
async function panFrom(page: Page, how: "right" | "middle" | "space") {
  const before = await viewOf(page);
  const spot = await emptyIn(page, "Area");
  if (how === "space") await page.keyboard.down("Space");
  await dragBetween(page, spot, { x: spot.x + 60, y: spot.y + 30 }, { button: how === "space" ? "left" : how });
  if (how === "space") await page.keyboard.up("Space");
  await expect.poll(() => viewOf(page), how).not.toBe(before);
  await expect(page.getByTestId("menu-toolbox")).toHaveCount(0);
}

test("S2B-06: inside a frame, Shift + drag draws an adding lasso; the middle button, Space + drag and the wheel pan and zoom; a right click opens the frame toolbox with the actions of item 10", async ({ page }) => {
  const { frame, start } = await openArea(page);

  // Shift + drag from an empty spot inside the frame around Customer adds it to the selection (web_users)
  await card(page, "web_users").getByTestId("card-name").click();
  await dragBetween(page, await screenPoint(page, { x: 480, y: 16 }), await screenPoint(page, { x: 768, y: 330 }), { shift: true });
  await expect(page.getByTestId("selection-count")).toHaveText("2 items selected");
  expect(await selectedNames(page)).toEqual(["Customer", "web_users"]);
  expect(await frame()).toMatchObject({ x: start.x, y: start.y }); // the frame did not move
  await page.keyboard.press("Escape");

  // the middle button and Space + drag pan from inside the frame; nothing moves, no toolbox (the right drag: below)
  await panFrom(page, "middle");
  await panFrom(page, "space");
  expect(await frame()).toMatchObject({ x: start.x, y: start.y });

  // the wheel pans, Ctrl + wheel zooms, also over the frame
  let spot = await emptyIn(page, "Area");
  const z0 = await zoomOf(page), v0 = await viewOf(page);
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => viewOf(page)).not.toBe(v0);
  expect(await zoomOf(page)).toBe(z0);
  spot = await emptyIn(page, "Area");
  await page.mouse.move(spot.x, spot.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -200);
  await page.keyboard.up("Control");
  await expect.poll(() => zoomOf(page)).toBeGreaterThan(z0);
  expect(await frame()).toMatchObject({ x: start.x, y: start.y });

  // a right click without moving: the frame's toolbox
  // slice 2c adds “Collapse into one block” (its item 1)
  // slice 3a adds “Add a note to this frame” (prototype ctxFor)
  expect(await toolboxLabels(page, await emptyIn(page, "Area"))).toEqual(["Rename…", "Collapse into one block", "Fit frame to its content", "Select its cards", "Zoom to frame", "Add a note to this frame", "Delete frame (keeps its cards)"]);
  await expect(page.getByTestId("menu-toolbox")).toContainText("Area");
  await closeToolbox(page);
});

test("S2B-06: inside a frame, a right drag pans; nothing moves, no toolbox", async ({ page }) => {
  // chore CI e2e (Łukasz, 6 November 2026): docs/known-limitations.md, "A right-button pan opens the toolbox on Linux and
  // macOS"; fixed in the slice "InfoMapper's canvas and menus"
  test.fail(process.platform !== "win32", "Known limitation: on Linux and macOS contextmenu comes on the right button's press, before any move, so a right-button pan opens the toolbox (src/canvas/CanvasModes.tsx:198)");
  const { frame, start } = await openArea(page);
  await panFrom(page, "right");
  expect(await frame()).toMatchObject({ x: start.x, y: start.y });
});
