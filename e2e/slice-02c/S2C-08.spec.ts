import { blockHeight } from "../../src/domain/model/frames";
import { expect, test } from "./fixtures";
import {
  AROUND,
  blockEl,
  box,
  canvasUrl,
  collapsedFrame,
  expectToast,
  frameNamed,
  isCollapsed,
  item,
  key,
  loadItems,
  makeFrame,
  overlaps,
  openCanvas,
  removeCard,
  RETAIL,
  signInAs,
  treeItem,
  FRAMED,
} from "./helpers";

test("S2C-08: “Collapse all” and “Expand all” in the canvas overview, one undo step each", async ({ page }) => {
  await makeFrame(AROUND.tables, { name: "Tables" });
  await makeFrame(AROUND.sales, { name: "Sales" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  const collapseAll = page.locator('[data-testid="button-frames-collapse-all"]:visible');
  const expandAll = page.locator('[data-testid="button-frames-expand-all"]:visible');
  const both = async () => [await isCollapsed("Tables"), await isCollapsed("Sales")];

  await collapseAll.click();
  await expectToast(page, "All frames collapsed. Lines between them are bundled.");
  await expect.poll(both).toEqual([true, true]);
  await expect(page.getByTestId("block")).toHaveCount(2);
  await key(page, "Control+z");
  await expect.poll(both).toEqual([false, false]);
  await expect(page.getByTestId("block")).toHaveCount(0);

  await collapseAll.click();
  await expect.poll(both).toEqual([true, true]);
  await expandAll.click();
  await expectToast(page, "All frames expanded.");
  await expect.poll(both).toEqual([false, false]);
  await expect(page.getByTestId("frame")).toHaveCount(2);
  await key(page, "Control+z");
  await expect.poll(both).toEqual([true, true]);
});

test("S2C-08: without frames the overview offers neither", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await expect(page.getByTestId("inspector-overview")).toBeVisible();
  await expect(page.getByTestId("button-frames-collapse-all")).toHaveCount(0);
  await expect(page.getByTestId("button-frames-expand-all")).toHaveCount(0);
});

test("S2C-08: Fit everything shows the block; the Overview draws the block, not the hidden cards; a new card placed in the view never lands on the block", async ({ page }) => {
  await collapsedFrame(AROUND.all, { name: "Everything" });
  const f = (await frameNamed("Everything"))!;
  const block = { x: f.x, y: f.y, w: 280, h: blockHeight(7) };
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 600, y: 400, zoom: 0.3 });

  // F: the block fits in the view, in its middle
  await key(page, "f");
  const pane = await box(page.locator(".react-flow__pane"));
  await expect
    .poll(async () => {
      const b = await box(blockEl(page, "Everything"));
      return b.x >= pane.x && b.y >= pane.y && b.x + b.width <= pane.x + pane.width && b.y + b.height <= pane.y + pane.height && Math.abs(b.x + b.width / 2 - (pane.x + pane.width / 2)) < 60;
    })
    .toBe(true);

  // the Overview: one block, no cards
  const overview = page.getByTestId("panel-overview");
  await expect(overview.locator("rect.mb")).toHaveCount(1);
  await expect(overview.locator("rect.me, rect.ms")).toHaveCount(0);

  // a click on an element in the left panel places it in a free spot of the view: never on the block
  await treeItem(page, "Customer Address").click();
  await expect.poll(async () => (await loadItems(RETAIL)).length).toBe(8);
  const placed = await item("Customer Address");
  expect(overlaps({ x: placed.x, y: placed.y, w: 256, h: placed.height }, block)).toBe(false);
  expect(placed.frame_id).toBeNull();
});

test("S2C-08: “Add the N missing” for a card hidden in a collapsed frame places beside the block, never on it (Łukasz's decision (ii))", async ({ page }) => {
  await removeCard("customers");
  await collapsedFrame(AROUND.customer, { name: "Customer", concept: "Customer" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  await treeItem(page, "Customer").click();
  const add = page.getByTestId("panel-entity").getByTestId("button-feed-all");
  await expect(add).toHaveText("Add the 1 missing to this canvas");
  await add.click();
  await expectToast(page, "Added 1 source table next to the selection.");
  await expect.poll(async () => (await loadItems(RETAIL)).length).toBe(7);
  const customers = await item("customers");
  // left of the block (480, 0): 160 px gap, at the block's top
  expect({ x: customers.x, y: customers.y }).toEqual({ x: 480 - 256 - 160, y: 0 });
  expect(overlaps({ x: customers.x, y: customers.y, w: 256, h: customers.height }, { x: 480, y: 0, w: 280, h: blockHeight(1) })).toBe(false);
  expect(customers.frame_id).toBeNull();
});
