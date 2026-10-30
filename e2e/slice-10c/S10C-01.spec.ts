import { expect, test } from "./fixtures";
import { attributeOf, attributesOf, canvasUrl, copyRow, COPY_TOAST, expectToast, openCanvas, pasteOn, rawAttribute, rawDb, signInAs } from "./helpers";

// Copy and paste (items 3 to 5, P8): the copy's fields, last on the entity, its panel with the name selected, one undo
// step.

test("S10C-01: a primary key copied into another entity is a foreign key with the original's fields, last, its name selected; undo and redo", async ({ page }) => {
  const original = await attributeOf("Customer", "customer_id");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await copyRow(page, "Customer", "customer_id");
  await expectToast(page, COPY_TOAST("customer_id"));
  await pasteOn(page, "Order Line", "customer_id");
  await expectToast(page, "Pasted “customer_id” into Order Line.");

  await expect.poll(async () => (await attributesOf("Order Line")).at(-1)?.name).toBe("customer_id");
  const copy = (await attributesOf("Order Line")).at(-1)!;
  expect(copy).toMatchObject({
    data_type: original.data_type,
    custom_type: original.custom_type,
    type_length: original.type_length,
    type_precision: original.type_precision,
    type_scale: original.type_scale,
    is_pii: original.is_pii,
    is_nullable: original.is_nullable,
    definition_html: original.definition_html,
    is_primary_key: false,
    is_foreign_key: true,
    is_business_key: false,
    copied_from_attribute_id: original.id,
  });
  // no mappings, requirement links or labels
  const db = await rawDb();
  expect(db.mapping.filter((m) => m.attribute_id === copy.id)).toEqual([]);
  expect(db.requirement_link.filter((l) => l.attribute_id === copy.id)).toEqual([]);
  expect(db.label_link.filter((l) => l.attribute_id === copy.id)).toEqual([]);

  // its panel, the name focused and selected
  const name = page.getByTestId("panel-attribute").getByTestId("input-attribute-name");
  await expect(name).toHaveValue("customer_id");
  await expect(name).toBeFocused();
  expect(await name.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, "customer_id".length]);

  // one undo step removes it; redo brings it back
  await name.blur();
  await page.getByTestId("button-undo").click();
  await expect.poll(async () => (await rawAttribute(copy.id))?.deleted_at).not.toBeNull();
  await page.getByTestId("button-redo").click();
  await expect.poll(async () => (await rawAttribute(copy.id))?.deleted_at).toBeNull();
});

test("S10C-01: a copy of an attribute that is not a primary key is no foreign key", async ({ page }) => {
  const email = await attributeOf("Customer", "email");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await copyRow(page, "Customer", "email");
  await pasteOn(page, "Order Line", "email");
  await expectToast(page, "Pasted “email” into Order Line.");
  await expect.poll(async () => (await attributesOf("Order Line")).at(-1)?.name).toBe("email");
  expect((await attributesOf("Order Line")).at(-1)).toMatchObject({ is_foreign_key: false, is_primary_key: false, is_pii: email.is_pii, copied_from_attribute_id: email.id });
});
