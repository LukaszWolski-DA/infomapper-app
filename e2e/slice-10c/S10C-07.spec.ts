import { expect, test } from "./fixtures";
import { attributeOf, canvasUrl, deleteAs, expectAttributeShown, openCanvas, pasteAs, rawAttribute, rowNamed, signInAs } from "./helpers";

// Stop following (item 10): the link cleared, the fields editable, the original's list without it; one undo step. The
// same on a copy whose original is deleted.

test("S10C-07: Stop following detaches a copy; one undo links it again", async ({ page }) => {
  const original = await attributeOf("Customer", "customer_id");
  const copy = await pasteAs("Order Line", original);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await rowNamed(page, "Order Line", "customer_id").click();
  await expectAttributeShown(page, "Order Line.customer_id");
  const panel = page.getByTestId("panel-attribute");
  await expect(panel.getByTestId("select-attribute-type")).toBeDisabled();

  await panel.getByTestId("button-stop-following").click();
  await expect.poll(async () => (await rawAttribute(copy))!.copied_from_attribute_id).toBeNull();
  await expect(panel.getByTestId("select-attribute-type")).toBeEnabled();
  await expect(panel.getByTestId("note-copied-from")).toHaveCount(0);
  await rowNamed(page, "Customer", "customer_id").click();
  await expectAttributeShown(page, "Customer.customer_id");
  await expect(panel.getByTestId("fold-attribute-copies")).toHaveCount(0);

  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await rawAttribute(copy))!.copied_from_attribute_id).toBe(original.id);
  await expect(panel.getByTestId("item-attribute-copy")).toHaveText(["Order Line.customer_id"]);
});

test("S10C-07: Stop following works on a copy whose original is deleted", async ({ page }) => {
  const original = await attributeOf("Customer", "customer_id");
  const copy = await pasteAs("Order Line", original);
  await deleteAs(original.id);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await rowNamed(page, "Order Line", "customer_id").click();
  await expectAttributeShown(page, "Order Line.customer_id");
  const panel = page.getByTestId("panel-attribute");
  await expect(panel.getByTestId("note-copied-from")).toContainText("Copied from Customer.customer_id, which was deleted.");
  await panel.getByTestId("button-stop-following").click();
  await expect.poll(async () => (await rawAttribute(copy))!.copied_from_attribute_id).toBeNull();
  await expect(panel.getByTestId("select-attribute-type")).toBeEnabled();
});
