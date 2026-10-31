import { expect, test } from "./fixtures";
import { attributeBox, canvasRow, canvasUrl, entityBox, expectBox, FULL, headerOf, idsOf, openCanvas, rowTextOf, setAttributeAlias, setEntityAlias, signInAs } from "./helpers";

// Attribute aliases on a canvas (items 8, 10): “Attribute aliases” shows customer_id's alias on its row and names on
// rows without one; the two check boxes are independent.

test("S11-03: checking “Attribute aliases” shows “Numer klienta” on customer_id's row and names elsewhere; the check boxes are independent", async ({ page }) => {
  await setEntityAlias("Customer", "Klient");
  await setAttributeAlias("Customer", "customer_id", "Numer klienta");
  const { itemId, attributeId } = await idsOf("Customer", "customer_id");
  const email = (await idsOf("Customer", "email")).attributeId;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  await expect(rowTextOf(page, itemId, attributeId)).toHaveText("customer_id");

  await attributeBox(page).click();
  await expect(rowTextOf(page, itemId, attributeId)).toHaveText("Numer klienta");
  await expect(rowTextOf(page, itemId, attributeId)).toHaveAttribute("title", "Numer klienta");
  await expect(rowTextOf(page, itemId, email)).toHaveText("email");
  await expectBox(attributeBox(page), "alias");
  // the entity dimension is untouched
  await expectBox(entityBox(page), "name");
  await expect(headerOf(page, itemId)).toHaveText("Customer");
  await expect.poll(async () => ({ ...(await canvasRow()) })).toMatchObject({ attribute_names: "alias", entity_names: null });

  await entityBox(page).click();
  await expect(headerOf(page, itemId)).toHaveText("Klient");
  await attributeBox(page).click();
  await expect(rowTextOf(page, itemId, attributeId)).toHaveText("customer_id");
  await expect(headerOf(page, itemId)).toHaveText("Klient");
  await expect.poll(async () => ({ ...(await canvasRow()) })).toMatchObject({ attribute_names: null, entity_names: "alias" });
});
