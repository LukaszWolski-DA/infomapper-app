import { expect, test } from "./fixtures";
import { attrId, dimensionRow, hints, hintsOk, hydrated, liveKeys, openAttribute, openEntity, openStar, relId, signInAs, undoButton } from "./helpers";

// RP-06 (R3): clearing ship_date_key's foreign key flag makes its link inactive: the Dimensions row says "no key", the
// hint names Dim Date as Ship date, and the link row stays (nothing deletes it); one undo brings the flag and so the
// link back.

test("RP-06: the FK flag cleared on ship_date_key: no key and its hint, the link kept; undo brings it back", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  const ship = relId("date>sales:ship");
  await openAttribute(page, "Fact Sales", "ship_date_key");
  await expect(page.getByTestId("item-cube-carries")).toHaveText(/^Dim Date as Ship date\s*relationship$/);
  await page.getByTestId("flags-attribute").getByRole("button", { name: "Foreign key" }).click();
  await expect(page.getByTestId("item-cube-carries")).toHaveCount(0);
  await openEntity(page, "Fact Sales");
  await expect(dimensionRow(page, ship)).toHaveText(/^Dim Date as Ship date\s*no key\s*Add key$/);
  await expect(hints(page)).toHaveText(["Dim Date as Ship date is related, but no key carries it."]);
  // the link is kept, inactive
  expect((await liveKeys()).some((k) => k.relationship_id === ship && k.attribute_id === attrId("sales.ship_date_key"))).toBe(true);

  await undoButton(page).click();
  await expect(dimensionRow(page, ship)).toHaveText(/^Dim Date as Ship date\s*key ship_date_key\s*no match → -1$/);
  await expect(hintsOk(page)).toBeVisible();
});
