import { expect, test } from "./fixtures";
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

test("S2B-06: inside a frame, Shift + drag draws an adding lasso; right drag, middle button, Space + drag and the wheel pan and zoom; a right click opens the frame toolbox with the actions of item 10", async ({ page }) => {
  await makeFrame({ x: 472, y: 0, width: 304, height: 856 }, { name: "Area" }); // Customer and Sales Order
  const frame = async () => (await frameNamed("Area"))!;
  const start = await frame();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  // Shift + drag from an empty spot inside the frame around Customer adds it to the selection (web_users)
  await card(page, "web_users").getByTestId("card-name").click();
  await dragBetween(page, await screenPoint(page, { x: 480, y: 16 }), await screenPoint(page, { x: 768, y: 330 }), { shift: true });
  await expect(page.getByTestId("selection-count")).toHaveText("2 items selected");
  expect(await selectedNames(page)).toEqual(["Customer", "web_users"]);
  expect(await frame()).toMatchObject({ x: start.x, y: start.y }); // the frame did not move
  await page.keyboard.press("Escape");

  // right drag, the middle button and Space + drag pan from inside the frame; nothing moves, no toolbox
  const panFrom = async (how: "right" | "middle" | "space") => {
    const before = await viewOf(page);
    const spot = await emptyIn(page, "Area");
    if (how === "space") await page.keyboard.down("Space");
    await dragBetween(page, spot, { x: spot.x + 60, y: spot.y + 30 }, { button: how === "space" ? "left" : how });
    if (how === "space") await page.keyboard.up("Space");
    await expect.poll(() => viewOf(page), how).not.toBe(before);
    await expect(page.getByTestId("menu-toolbox")).toHaveCount(0);
  };
  await panFrom("right");
  await panFrom("middle");
  await panFrom("space");
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
  expect(await toolboxLabels(page, await emptyIn(page, "Area"))).toEqual(["Rename…", "Fit frame to its content", "Select its cards", "Zoom to frame", "Delete frame (keeps its cards)"]);
  await expect(page.getByTestId("menu-toolbox")).toContainText("Area");
  await closeToolbox(page);
});
