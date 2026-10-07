import { expect, test } from "./fixtures";
import { canvasUrl, card, emptySpot, headPoint, openCanvas, selectedNames, signInAs, WHOLE } from "./helpers";

test("S2A-02: Shift+click adds and removes cards; Ctrl+A selects every card on the canvas; Esc clears; the box shows “N selected” and the panel lists the cards with the right counts", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  const marks = page.getByTestId("mark-selected");
  const shiftClick = async (name: string) => {
    const at = await headPoint(page, name);
    await page.keyboard.down("Shift");
    await page.mouse.click(at.x, at.y);
    await page.keyboard.up("Shift");
  };

  // a plain click selects one card; Shift+click adds two more
  await card(page, "Customer").getByTestId("card-name").click();
  await expect(page.getByTestId("panel-entity")).toBeVisible();
  await shiftClick("Sales Order");
  await shiftClick("customers");
  await expect(marks).toHaveCount(3);
  await expect(page.getByTestId("label-selection")).toHaveText("3 selected");
  await expect(page.getByTestId("box-selection")).toHaveCount(1);
  await expect(page.getByTestId("selection-count")).toHaveText("3 items selected");
  await expect(page.getByTestId("selection-kinds")).toHaveText("2 entities, 1 table.");
  expect(await selectedNames(page)).toEqual(["Customer", "Sales Order", "customers"]);

  // Shift+click on a selected card takes it out
  await shiftClick("Sales Order");
  await expect(marks).toHaveCount(2);
  await expect(page.getByTestId("selection-kinds")).toHaveText("1 entity, 1 table.");
  expect(await selectedNames(page)).toEqual(["Customer", "customers"]);
  // a link in the list selects only that card
  await page.getByTestId("selection-item").filter({ hasText: "customers" }).click();
  await expect(page.getByTestId("panel-source-table")).toBeVisible();
  await expect(marks).toHaveCount(0);

  // Ctrl+A outside text fields selects all 7 cards
  const spot = await emptySpot(page);
  await page.mouse.click(spot.x, spot.y);
  await page.keyboard.press("Control+a");
  await expect(marks).toHaveCount(7);
  await expect(page.getByTestId("label-selection")).toHaveText("7 selected");
  await expect(page.getByTestId("selection-kinds")).toHaveText("3 entities, 4 tables.");
  expect(await selectedNames(page)).toEqual(["Customer", "Order Line", "Sales Order", "customers", "order_header", "order_line", "web_users"]);

  // Esc clears
  await page.keyboard.press("Escape");
  await expect(marks).toHaveCount(0);
  await expect(page.getByTestId("box-selection")).toHaveCount(0);
  await expect(page.getByTestId("inspector-overview")).toBeVisible();

  // Ctrl+A in a text field selects its text, not the cards
  await page.getByTestId("input-tree-search").fill("cust");
  await page.getByTestId("input-tree-search").press("Control+a");
  await expect(marks).toHaveCount(0);
});
