import { expect, test } from "./fixtures";
import { attributeOf, canvasUrl, expectAttributeShown, expectToast, openCanvas, pasteAs, rawAttribute, rowNamed, signInAs } from "./helpers";

// Deleting an original (items 8, 9; F2, F6, F7): a second click that names its copies; the copies keep naming it,
// read-only; Undo brings it back and they follow again. An attribute without mappings or copies still goes at once.

test("S10C-05: deleting an original asks a second click naming its copies; they keep naming it, read-only; Undo brings it back", async ({ page }) => {
  const original = await attributeOf("Customer", "customer_id");
  const c1 = await pasteAs("Order Line", original);
  await pasteAs("Product", original);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await rowNamed(page, "Customer", "customer_id").click();
  await expectAttributeShown(page, "Customer.customer_id");
  const panel = page.getByTestId("panel-attribute");
  const button = panel.getByTestId("button-delete-attribute");

  await button.click();
  await expect(button).toHaveText(/^Click again to delete(, with \d+ mappings?)?; these copies stop following it: Order Line\.customer_id, Product\.customer_id$/);
  // left alone, it disarms and nothing is deleted
  await expect(button).toHaveText("Delete attribute", { timeout: 6000 });
  expect((await rawAttribute(original.id))!.deleted_at).toBeNull();

  await button.click();
  await button.click();
  await expectToast(page, /^Attribute deleted( together with \d+ mappings?)?\. 2 copies no longer follow it$/);
  await expect.poll(async () => (await rawAttribute(original.id))!.deleted_at).not.toBeNull();

  // the copy names its deleted original; its followed fields stay read-only, with Stop following
  await rowNamed(page, "Order Line", "customer_id").click();
  await expectAttributeShown(page, "Order Line.customer_id");
  await expect(panel.getByTestId("note-copied-from")).toContainText("Copied from Customer.customer_id, which was deleted.");
  await expect(panel.getByTestId("select-attribute-type")).toBeDisabled();
  await expect(panel.getByTestId("button-stop-following")).toBeVisible();

  // Undo brings the original back and the copy follows it again, unwritten
  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await rawAttribute(original.id))!.deleted_at).toBeNull();
  await expect(panel.getByTestId("link-copied-from")).toHaveText("Customer.customer_id");
  expect((await rawAttribute(c1))!.version).toBe(1);
});

test("S10C-05: an attribute without mappings or copies is deleted at once, with Undo in the toast (S1B-13)", async ({ page }) => {
  const original = await attributeOf("Customer", "customer_id");
  const copy = await pasteAs("Order Line", original);
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await rowNamed(page, "Order Line", "customer_id").click();
  await expectAttributeShown(page, "Order Line.customer_id");
  await page.getByTestId("panel-attribute").getByTestId("button-delete-attribute").click();
  await expectToast(page, "Attribute deleted");
  await expect.poll(async () => (await rawAttribute(copy))!.deleted_at).not.toBeNull();
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await rawAttribute(copy))!.deleted_at).toBeNull();
});
