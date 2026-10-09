import { expect, test } from "./fixtures";
import {
  AROUND,
  blockEl,
  box,
  canvasUrl,
  card,
  cardMarks,
  collapsedFrame,
  dragBetween,
  frameEl,
  headPoint,
  isCollapsed,
  item,
  key,
  lasso,
  loadModel,
  makeFrame,
  openCanvas,
  paneMiddle,
  row,
  screenPoint,
  selectedNames,
  shiftClick,
  signInAs,
  treeItem,
  FRAMED,
} from "./helpers";

/** Where Customer's hidden rows are, below its block (the block covers 480..760 × 0..118). */
const HIDDEN_ROW = { x: 620, y: 250 };

test("S2C-02: the cards of a collapsed frame cannot be hovered, lassoed, dropped on or targeted", async ({ page }) => {
  await collapsedFrame(AROUND.customer, { name: "Customer", concept: "Customer" });
  const model0 = await loadModel();
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await expect(blockEl(page, "Customer")).toBeVisible();
  await expect(card(page, "Customer")).toHaveCount(0);
  const hiddenRow = await screenPoint(page, HIDDEN_ROW);

  // hover: nothing under the mouse, no lines emphasised
  await page.mouse.move(hiddenRow.x, hiddenRow.y);
  await page.waitForTimeout(300);
  await expect(page.getByTestId("layer-hover-lines")).toHaveCount(0);

  // a lasso around Customer's hidden place (not around the block) catches nothing
  await lasso(page, { x: 780, y: 330 }, { x: 490, y: 30 });
  await expect(page.getByTestId("inspector-overview")).toBeVisible();
  await expect(cardMarks(page)).toHaveCount(0);

  // a column dropped where Customer's rows are hidden maps nothing
  const model = await loadModel();
  const web = model.sourceTables.find((t) => t.name === "web_users")!;
  const email = model.sourceColumns.find((c) => c.source_table_id === web.id && c.name === "email")!;
  const from = await box(row(page, "web_users", email.id));
  await dragBetween(page, { x: from.x + from.width / 2, y: from.y + from.height / 2 }, hiddenRow);
  await page.waitForTimeout(500);
  await expect(page.getByTestId("popover-map-choice")).toHaveCount(0);

  // relating Sales Order to where Customer is hidden draws no relationship
  await card(page, "Sales Order").getByTestId("button-card-relate").click();
  await expect(page.getByTestId("area-canvas")).toHaveAttribute("data-mode", "relate");
  await page.mouse.click(hiddenRow.x, hiddenRow.y);
  await page.waitForTimeout(500);
  const after = await loadModel();
  expect(after.mappings.length).toBe(model0.mappings.length);
  expect(after.relationships.length).toBe(model0.relationships.length);
});

test("S2C-02: a hidden card selected from the left panel is selected, shows its panel and the view centres on its block; the arrow keys do not move it; a click on its row in the block expands the frame and selects it", async ({ page }) => {
  await collapsedFrame(AROUND.customer, { name: "Customer", concept: "Customer" });
  const customer0 = await item("Customer");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);

  await treeItem(page, "Customer").click();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await expect(page.getByTestId("panel-entity")).toContainText("Customer");
  // the block is in the middle of the view
  const mid = await paneMiddle(page);
  await expect
    .poll(async () => {
      const b = await box(blockEl(page, "Customer"));
      return Math.abs(b.x + b.width / 2 - mid.x) < 4 && Math.abs(b.y + b.height / 2 - mid.y) < 4;
    })
    .toBe(true);

  // the arrow keys do not move a hidden card (Łukasz's decision (b))
  await key(page, "ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await page.waitForTimeout(800);
  const customer1 = await item("Customer");
  expect({ x: customer1.x, y: customer1.y, v: customer1.version }).toEqual({ x: customer0.x, y: customer0.y, v: customer0.version });

  // a click on its row in the block: the frame expands and the card is selected
  await blockEl(page, "Customer").locator(`[data-member="${customer0.id}"]`).click();
  await expect.poll(() => isCollapsed("Customer")).toBe(false);
  await expect(frameEl(page, "Customer")).toBeVisible();
  await expect(card(page, "Customer")).toBeVisible();
  await expect(page.getByTestId("panel-entity")).toContainText("Customer");
});

test("S2C-02: collapsing a frame takes its cards out of a selection of several (prototype pruneMulti)", async ({ page }) => {
  await makeFrame(AROUND.customer, { name: "Area" });
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FRAMED);
  await card(page, "Customer").getByTestId("card-name").click();
  await shiftClick(page, await headPoint(page, "Sales Order"));
  await shiftClick(page, await headPoint(page, "Order Line"));
  await expect(page.getByTestId("selection-count")).toHaveText("3 items selected");

  await frameEl(page, "Area").getByTestId("button-frame-collapse").click();
  await expect.poll(() => isCollapsed("Area")).toBe(true);
  await expect(page.getByTestId("selection-count")).toHaveText("2 items selected");
  expect(await selectedNames(page)).toEqual(["Order Line", "Sales Order"]);
  await expect(cardMarks(page)).toHaveCount(2);
});
