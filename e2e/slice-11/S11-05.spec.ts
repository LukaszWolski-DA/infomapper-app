import { expect, test } from "./fixtures";
import { attributeBox, canvasRow, canvasUrl, entityBox, exceptionsOf, expectBox, HALF, headerOf, idsOf, openCanvas, setEntityAlias, setException, signInAs, tintOf, undo } from "./helpers";

// Mixed (items 8, P5): with one card's entity exception the check box is indeterminate; a click shows aliases on every
// card and clears the exception; one undo restores the canvas's mode and the exception with its tint; the attribute
// dimension is untouched.

test("S11-05: an exception makes “Entity aliases” indeterminate; a click shows aliases everywhere and clears it; one undo restores both", async ({ page }) => {
  await setEntityAlias("Customer", "Klient");
  await setEntityAlias("Sales Order", "Zamówienie");
  await setException("Sales Order", { entityNames: "alias" });
  const customer = (await idsOf("Customer")).itemId;
  const order = (await idsOf("Sales Order")).itemId;
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), HALF);
  await expectBox(entityBox(page), "mixed");
  await expectBox(attributeBox(page), "name");
  await expect(headerOf(page, order)).toHaveText("Zamówienie");
  await expect(headerOf(page, customer)).toHaveText("Customer");
  expect(await tintOf(page, order)).toEqual({ header: true, rows: false });

  await entityBox(page).click();
  await expect(headerOf(page, customer)).toHaveText("Klient");
  await expect(headerOf(page, order)).toHaveText("Zamówienie");
  await expect.poll(() => tintOf(page, order)).toEqual({ header: false, rows: false });
  await expectBox(entityBox(page), "alias");
  await expect.poll(async () => (await canvasRow()).entity_names).toBe("alias");
  await expect.poll(() => exceptionsOf("Sales Order")).toEqual({ entity: null, attribute: null });

  await undo(page);
  await expect.poll(async () => (await canvasRow()).entity_names).toBeNull();
  await expect.poll(() => exceptionsOf("Sales Order")).toEqual({ entity: "alias", attribute: null });
  await expect(headerOf(page, customer)).toHaveText("Customer");
  await expect.poll(() => tintOf(page, order)).toEqual({ header: true, rows: false });
  await expectBox(entityBox(page), "mixed");
  await expectBox(attributeBox(page), "name");
  expect((await canvasRow()).attribute_names).toBeNull();
});
