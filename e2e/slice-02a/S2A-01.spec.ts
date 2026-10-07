import { expect, test } from "./fixtures";
import { canvasUrl, emptySpot, lasso, openCanvas, selectedNames, signInAs, WHOLE } from "./helpers";

test("S2A-01: on Customer & orders, a lasso fully around Customer and Sales Order and partly over Order Line selects exactly those two; a lasso started with Shift adds to the selection; a click on the empty canvas clears it", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE);
  const marks = page.getByTestId("mark-selected");

  // Customer (496, 40) and Sales Order (496, 568) fully inside; Order Line (840, 568) only partly: its left 60 px.
  // It starts above the cards, where no line runs.
  await lasso(page, { x: 470, y: 8 }, { x: 900, y: 840 });
  await expect(marks).toHaveCount(2);
  expect(await selectedNames(page)).toEqual(["Customer", "Sales Order"]);
  await expect(page.getByTestId("label-selection")).toHaveText("2 selected");
  await expect(page.getByTestId("lasso")).toHaveCount(0); // gone on release

  // with Shift held at the start, a lasso around order_line (1176, 600) adds it
  await lasso(page, { x: 1160, y: 590 }, { x: 1450, y: 840 }, { shift: true });
  await expect(marks).toHaveCount(3);
  expect(await selectedNames(page)).toEqual(["Customer", "Sales Order", "order_line"]);

  // without Shift, a new lasso replaces the selection
  await lasso(page, { x: 20, y: 8 }, { x: 310, y: 370 });
  await expect(page.getByTestId("panel-source-table")).toBeVisible(); // only customers: a single selection
  await expect(marks).toHaveCount(0);

  // a click on the empty canvas without moving clears it
  await lasso(page, { x: 470, y: 8 }, { x: 900, y: 840 });
  await expect(marks).toHaveCount(2);
  const spot = await emptySpot(page);
  await page.mouse.click(spot.x, spot.y);
  await expect(marks).toHaveCount(0);
  await expect(page.getByTestId("inspector-overview")).toBeVisible();
});
