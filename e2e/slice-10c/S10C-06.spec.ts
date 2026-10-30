import { expect, test } from "./fixtures";
import { attributeOf, canvasUrl, clickCard, openCanvas, pasteAs, signInAs } from "./helpers";

// D-47's preview (item 8, F8): the copies in other entities that lose their original; a copy inside the entity goes with
// it and is counted as an attribute.

test("S10C-06: deleting Customer lists the copies elsewhere that lose their original", async ({ page }) => {
  const original = await attributeOf("Customer", "customer_id");
  await pasteAs("Order Line", original);
  await pasteAs("Customer", original);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await clickCard(page, "Customer");
  await page.getByTestId("button-delete-entity").click();
  const rows = page.getByTestId("dialog-delete-entity").getByTestId("table-entity-impact").locator("tbody tr");
  await expect(rows.filter({ hasText: /cop(y|ies)/ })).toHaveText(/^1 copy\s*loses its original: Order Line\.customer_id$/);
  await expect(rows.filter({ hasText: /attributes/ })).toHaveText(/^9 attributes\s*deleted$/);
});
