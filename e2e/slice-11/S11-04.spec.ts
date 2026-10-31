import { expect, test } from "./fixtures";
import { canvasUrl, entityBox, exceptionsOf, expectBox, FULL, headerOf, idsOf, openCanvas, pickSegment, rowTextOf, setAttributeAlias, setEntityAlias, signInAs, tintOf, undo } from "./helpers";

// A card's exceptions (items 9, 11): “Entity name: Alias” shows the alias while the canvas shows names and tints the
// header; “Attribute names: Alias” tints the rows; the segment equal to the canvas's mode clears it; one undo step each.

test("S11-04: a card's segments show its alias against the canvas, tint the header or the rows, and clear back; one undo step each", async ({ page }) => {
  await setEntityAlias("Customer", "Klient");
  await setAttributeAlias("Customer", "customer_id", "Numer klienta");
  const { itemId, attributeId } = await idsOf("Customer", "customer_id");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), FULL);
  expect(await tintOf(page, itemId)).toEqual({ header: false, rows: false });

  await pickSegment(page, itemId, "entity", "Alias");
  await expect(headerOf(page, itemId)).toHaveText("Klient");
  await expect.poll(() => tintOf(page, itemId)).toEqual({ header: true, rows: false });
  await expect.poll(() => exceptionsOf("Customer")).toEqual({ entity: "alias", attribute: null });
  await expectBox(entityBox(page), "mixed");

  await pickSegment(page, itemId, "attribute", "Alias");
  await expect(rowTextOf(page, itemId, attributeId)).toHaveText("Numer klienta");
  await expect.poll(() => tintOf(page, itemId)).toEqual({ header: true, rows: true });
  await expect.poll(() => exceptionsOf("Customer")).toEqual({ entity: "alias", attribute: "alias" });

  // the segment equal to the canvas's mode (names) clears the exception and its tint
  await pickSegment(page, itemId, "entity", "Name");
  await expect(headerOf(page, itemId)).toHaveText("Customer");
  await expect.poll(() => tintOf(page, itemId)).toEqual({ header: false, rows: true });
  await expect.poll(() => exceptionsOf("Customer")).toEqual({ entity: null, attribute: "alias" });

  await undo(page);
  await expect.poll(() => exceptionsOf("Customer")).toEqual({ entity: "alias", attribute: "alias" });
  await expect(headerOf(page, itemId)).toHaveText("Klient");
  await expect.poll(() => tintOf(page, itemId)).toEqual({ header: true, rows: true });
  await undo(page);
  await expect.poll(() => exceptionsOf("Customer")).toEqual({ entity: "alias", attribute: null });
  await expect.poll(() => tintOf(page, itemId)).toEqual({ header: true, rows: false });
  await expect(rowTextOf(page, itemId, attributeId)).toHaveText("customer_id");
});
