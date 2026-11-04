import { expect, test, type Page } from "./fixtures";
import { archive, canvasStored, canvasUrl, changeCanvasLookElsewhere, expectToast, hydrated, openCanvas, openCanvasMenu, SEED_IDS, signInAs, STALE } from "./helpers";

// S14B-07 (item 6, O3): after a refused look change the canvas shows the newest stored look with the toast, as a choice
// field does (D-66).

const GRIDS = ["dots", "lines", "none"] as const;
const canvasArea = (page: Page) => page.getByTestId("area-canvas");

test("S14B-07: a grid switch refused because the workspace was archived meanwhile: the stored grid shows, with the toast", async ({ page }) => {
  const co = SEED_IDS.canvasCustomerOrders;
  const stored = (await canvasStored(co)).look.grid;
  const other = GRIDS.find((g) => g !== stored)!;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await hydrated(page);
  const menu = await openCanvasMenu(page, "Customer & orders");
  await archive();
  await menu.getByTestId("group-canvas-grid").locator(`[data-grid="${other}"]`).click();
  await expectToast(page, /archived/i);
  await expect(canvasArea(page)).toHaveAttribute("data-grid", stored);
  expect((await canvasStored(co)).look.grid).toBe(stored);
});

test("S14B-07: a grid switch refused as stale shows the grid the other session stored, not the one before the click", async ({ page }) => {
  const co = SEED_IDS.canvasCustomerOrders;
  const before = (await canvasStored(co)).look.grid;
  const theirs = GRIDS.find((g) => g !== before)!;
  const mine = GRIDS.find((g) => g !== before && g !== theirs)!;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await hydrated(page);
  await changeCanvasLookElsewhere(co, { grid: theirs });
  const menu = await openCanvasMenu(page, "Customer & orders");
  await menu.getByTestId("group-canvas-grid").locator(`[data-grid="${mine}"]`).click();
  await expectToast(page, STALE);
  await expect(canvasArea(page)).toHaveAttribute("data-grid", theirs);
  expect((await canvasStored(co)).look.grid).toBe(theirs);
});
