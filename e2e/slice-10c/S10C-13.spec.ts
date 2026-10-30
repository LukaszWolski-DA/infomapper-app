import { expect, test } from "./fixtures";
import { attributeOf, canvasUrl, expectAttributeShown, openCanvas, pasteAs, rawAttribute, rowNamed, signInAs } from "./helpers";

// Undo keeps copies in step (F1): a type change undone after a copy was pasted brings the copy back too. The other
// cases (redo of a paste, undo of Stop following, an original brought back) are unit tests (`undo.test.ts`).

test("S10C-13: undo of a type change made before a paste brings the copy back with the original", async ({ page }) => {
  const original = await attributeOf("Customer", "customer_id");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await rowNamed(page, "Customer", "customer_id").click();
  await expectAttributeShown(page, "Customer.customer_id");
  await page.getByTestId("panel-attribute").getByTestId("select-attribute-type").selectOption("date");
  await expect.poll(async () => (await rawAttribute(original.id))!.data_type).toBe("date");

  // pasted afterwards, outside this person's undo history (another session)
  const copy = await pasteAs("Order Line", (await rawAttribute(original.id))!);
  expect((await rawAttribute(copy))!.data_type).toBe("date");

  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await rawAttribute(original.id))!.data_type).toBe(original.data_type);
  await expect.poll(async () => (await rawAttribute(copy))!.data_type).toBe(original.data_type);
});
