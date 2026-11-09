import { expect, test } from "./fixtures";
import { attrId, dimensionRows, hintsOk, hydrated, keyOf, openAttribute, openEntity, openStar, relId, signInAs } from "./helpers";

// RP-12 (RP-C): renaming Dim Date's primary key date_key to date_sk changes no link and brings no hint: keys are linked,
// never matched by name.

test("RP-12: Dim Date's date_key renamed date_sk: the links are unchanged, no key hints", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openAttribute(page, "Dim Date", "date_key");
  await page.getByTestId("input-attribute-name").fill("date_sk");
  await page.getByTestId("input-attribute-name").press("Tab");
  await openEntity(page, "Fact Sales");
  await expect(dimensionRows(page).filter({ hasText: "Dim Date" })).toHaveText([/key date_key · no match → -1$/, /key ship_date_key · no match → -1$/]);
  await expect(hintsOk(page)).toBeVisible();
  expect(await keyOf(relId("date>sales"))).toBe(attrId("sales.date_key"));
  expect(await keyOf(relId("date>sales:ship"))).toBe(attrId("sales.ship_date_key"));
});
