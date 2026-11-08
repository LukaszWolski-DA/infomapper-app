// S20-03 (card marks, PRD item 3, Z1–Z6): on "Customer & orders" Customer's header and last_order_id's row are orange
// (a key copied the wrong way is High), Sales Order's header and total_amount's row grey (calculated and mapped); their
// titles; a mark appears with a write and goes with its undo; a collapsed card and a card below 40 % keep the header's
// mark; alias mode keeps the marks; a reader sees the same marks. No element is added (classes and pseudo-elements).

import { expect, test } from "./fixtures";
import { canvasUrl, expectMark, headLine, hydrated, markTitleOf, openCanvas, rowNamed, rowType, signInAs, undo, WHOLE_CO } from "./helpers";
import { setCard } from "../slice-06a/helpers";
import { setNamesAs } from "../slice-11/helpers";

test("S20-03: the marks on the cards, their titles, a write and its undo, collapsed, below 40 %, aliases, a reader", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await hydrated(page);
  await expectMark(headLine(page, "Customer"), "high");
  await expectMark(rowType(page, "Customer", "last_order_id"), "high");
  await expectMark(rowType(page, "Customer", "email"), null);
  await expectMark(headLine(page, "Sales Order"), "normal");
  await expectMark(rowType(page, "Sales Order", "total_amount"), "normal");
  await expectMark(headLine(page, "Order Line"), null);

  // the titles, built on hover
  expect(await markTitleOf(rowType(page, "Customer", "last_order_id"))).toBe("Model checks: 1\nKeys copied the wrong way: Customer.last_order_id");
  expect(await markTitleOf(headLine(page, "Sales Order"))).toBe("Model checks: 1\nCalculated and mapped: Sales Order.total_amount");
  // the mark is a pseudo-element: the row's type has no child element, the header line its three as before
  await expect(rowType(page, "Customer", "last_order_id").locator("*")).toHaveCount(0);
  await expect(headLine(page, "Customer").locator(":scope > *")).toHaveCount(3);
  expect(await rowType(page, "Customer", "last_order_id").evaluate((el) => getComputedStyle(el, "::after").content)).toBe('"!"');

  // a write adds a mark (a second "order_number" in Sales Order: a duplicate name), its undo takes it away
  await rowNamed(page, "Sales Order", "currency_code").click();
  const name = page.getByTestId("input-attribute-name");
  await name.fill("Order_Number");
  await name.press("Enter");
  await expectMark(rowType(page, "Sales Order", "Order_Number"), "normal");
  await expectMark(rowType(page, "Sales Order", "order_number"), "normal");
  await undo(page);
  await expectMark(rowType(page, "Sales Order", "currency_code"), null);
  await expectMark(rowType(page, "Sales Order", "order_number"), null);
  await expectMark(headLine(page, "Sales Order"), "normal");

  // collapsed, and below 40 %: the header keeps its mark
  await setCard("Customer", { collapsed: true });
  await page.reload();
  await expectMark(headLine(page, "Customer"), "high");
  await openCanvas(page, canvasUrl(), { x: 10, y: 10, zoom: 0.3 });
  await expect(page.getByTestId("card-block").first()).toBeVisible();
  await expectMark(headLine(page, "Sales Order"), "normal");

  // alias mode: the marks stay (the cards are found by their aliases' absence: none is set, so the names show)
  await setNamesAs("entity", "alias");
  await setNamesAs("attribute", "alias");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expectMark(headLine(page, "Sales Order"), "normal");
  await expectMark(rowType(page, "Sales Order", "total_amount"), "normal");

  // a reader sees the same marks
  await signInAs(page, "Kasia Zielińska");
  await openCanvas(page, canvasUrl(), WHOLE_CO);
  await expectMark(headLine(page, "Customer"), "high");
  await expectMark(rowType(page, "Sales Order", "total_amount"), "normal");
});
