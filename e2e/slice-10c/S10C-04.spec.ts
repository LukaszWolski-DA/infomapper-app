import { expect, test } from "./fixtures";
import { attributeOf, backButton, canvasUrl, expectAttributeShown, openCanvas, pasteAs, rowNamed, signInAs } from "./helpers";

// The panels (item 7): an original lists its copies, a copy names its original; each selects the other, a history
// place (D-38).

test("S10C-04: the original lists its copies and the copy names its original, each a click away; Back returns", async ({ page }) => {
  const original = await attributeOf("Customer", "customer_id");
  await pasteAs("Order Line", original);
  await pasteAs("Product", original);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await rowNamed(page, "Customer", "customer_id").click();
  await expectAttributeShown(page, "Customer.customer_id");

  const panel = page.getByTestId("panel-attribute");
  const items = panel.getByTestId("item-attribute-copy");
  await expect(items).toHaveText(["Order Line.customer_id", "Product.customer_id"]);
  await items.filter({ hasText: "Order Line.customer_id" }).click();
  await expectAttributeShown(page, "Order Line.customer_id");
  await expect(panel.getByTestId("note-copied-from")).toContainText("Copied from Customer.customer_id");
  await backButton(page).click();
  await expectAttributeShown(page, "Customer.customer_id");

  // a copy whose entity has no card here opens its panel only
  await items.filter({ hasText: "Product.customer_id" }).click();
  await expectAttributeShown(page, "Product.customer_id");
  await panel.getByTestId("link-copied-from").click();
  await expectAttributeShown(page, "Customer.customer_id");
});
