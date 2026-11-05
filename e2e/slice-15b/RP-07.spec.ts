import { expect, test } from "./fixtures";
import { attrId, dimensionRow, hints, hydrated, keyOf, liveKeys, model, openAttribute, openEntity, openStar, relId, signInAs, undoButton } from "./helpers";

// RP-07 (R-9, R4): deleting ship_date_key asks the second click, which names the link; the delete takes the link, the
// relationship stays and asks for a key; one undo brings both back. A measure's delete names "1 measure".

test("RP-07: deleting ship_date_key names its link on the second click; the relationship stays; undo", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  const ship = relId("date>sales:ship");
  await openAttribute(page, "Fact Sales", "quantity");
  const del = page.getByTestId("button-delete-attribute");
  await del.click();
  // slice 15c (X-3): quantity is fed from the logical model, so its dimensional mapping is named too
  await expect(del).toHaveText("Click again to delete, with 1 measure and 1 dimensional mapping");

  await openAttribute(page, "Fact Sales", "ship_date_key");
  await del.click();
  await expect(del).toHaveText("Click again to delete; the link to Dim Date as Ship date is deleted, the relationship stays");
  await del.click();
  await expect.poll(async () => (await model()).attributes.some((a) => a.id === attrId("sales.ship_date_key"))).toBe(false);
  await expect.poll(() => keyOf(ship)).toBeUndefined();
  expect((await model()).relationships.some((r) => r.id === ship)).toBe(true);
  await openEntity(page, "Fact Sales");
  await expect(dimensionRow(page, ship)).toHaveText(/^Dim Date as Ship date\s*no key\s*Add key$/);
  await expect(hints(page)).toHaveText(["Dim Date as Ship date is related, but no key carries it."]);

  await undoButton(page).click();
  await expect.poll(() => keyOf(ship)).toBe(attrId("sales.ship_date_key"));
  await expect(dimensionRow(page, ship)).toHaveText(/^Dim Date as Ship date\s*key ship_date_key$/);
  expect((await liveKeys()).length).toBe(6);
});
