// S16-03 (slice 16, item 2, D-71): with three canvases, the last tab's "Move to start" puts it first and "Move right"
// moves it one place; the items that would not move it are disabled; with one canvas the four items are not shown.
// Each move is one undo step; the order stays after a reload; the project home's tiles follow it.

import { expect, test, type Page } from "./fixtures";
import { C360_PROJECT, canvasUrl, OM_PROJECT, OM_URL, openCanvasMenu, orderOf, RETAIL, signInAs, tabNames, THIRD, thirdCanvas, undoButton } from "./helpers";

const CO = "Customer & orders", OL = "Order lines & products";
const MOVES = ["menu-item-move-left", "menu-item-move-right", "menu-item-move-start", "menu-item-move-end"] as const;

/** Which of the four items of a tab's menu are disabled, as [left, right, start, end]. */
async function disabled(page: Page, canvasName: string): Promise<boolean[]> {
  const menu = await openCanvasMenu(page, canvasName);
  const states = await Promise.all(MOVES.map(async (id) => (await menu.getByTestId(id).getAttribute("data-disabled")) !== null));
  await page.keyboard.press("Escape");
  return states;
}
async function move(page: Page, canvasName: string, testId: (typeof MOVES)[number]) {
  const menu = await openCanvasMenu(page, canvasName);
  await menu.getByTestId(testId).click();
}
const tiles = (page: Page) => page.getByTestId("tile-canvas-name").allInnerTexts();

test("S16-03: the four items move a tab in the project's order, one undo step each; the order stays and the tiles follow", async ({ page }) => {
  await thirdCanvas();
  await signInAs(page, "Łukasz");
  await page.goto(OM_URL());
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  expect(await tabNames(page)).toEqual([CO, OL, THIRD]);

  // the items that would not move a tab are disabled
  expect(await disabled(page, THIRD)).toEqual([false, true, false, true]);
  expect(await disabled(page, CO)).toEqual([true, false, true, false]);
  expect(await disabled(page, OL)).toEqual([false, false, false, false]);

  await move(page, THIRD, "menu-item-move-start");
  await expect.poll(() => tabNames(page)).toEqual([THIRD, CO, OL]);
  await move(page, THIRD, "menu-item-move-right");
  await expect.poll(() => tabNames(page)).toEqual([CO, THIRD, OL]);
  expect(await orderOf(OM_PROJECT)).toEqual([CO, THIRD, OL]);

  // each move is one undo step
  await undoButton(page).click();
  await expect.poll(() => tabNames(page)).toEqual([THIRD, CO, OL]);
  await expect(page.getByTestId("toast").filter({ hasText: "Undone: Move canvas" })).toBeVisible();
  await undoButton(page).click();
  await expect.poll(() => tabNames(page)).toEqual([CO, OL, THIRD]);
  // and redone: the order the moves left
  await page.getByTestId("button-redo").click();
  await expect.poll(() => tabNames(page)).toEqual([THIRD, CO, OL]);

  // kept after a reload; the project home's tiles in the same order
  await page.reload();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  expect(await tabNames(page)).toEqual([THIRD, CO, OL]);
  await page.getByTestId("tab-home").click();
  await expect.poll(() => tiles(page)).toEqual([THIRD, CO, OL]);
});

test("S16-03: with one canvas the four items are not shown", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(canvasUrl(undefined, C360_PROJECT));
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-ready", "true");
  expect(await tabNames(page)).toEqual([CO]);
  const menu = await openCanvasMenu(page, CO);
  for (const id of MOVES) await expect(menu.getByTestId(id)).toHaveCount(0);
  await expect(menu.getByTestId("menu-item-duplicate")).toBeVisible();
});

test("S16-03: the project home's tile menu moves a canvas too", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await page.goto(`/w/${RETAIL}/p/${OM_PROJECT}`);
  await expect.poll(() => tiles(page)).toEqual([CO, OL]);
  const tile = page.getByTestId("tile-canvas").filter({ has: page.getByTestId("tile-canvas-name").getByText(OL, { exact: true }) });
  await tile.hover();
  await tile.getByTestId("button-canvas-menu").click();
  await page.getByTestId("menu-canvas").getByTestId("menu-item-move-left").click();
  await expect.poll(() => tiles(page)).toEqual([OL, CO]);
  expect(await orderOf(OM_PROJECT)).toEqual([OL, CO]);
});
