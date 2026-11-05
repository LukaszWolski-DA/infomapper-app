import { expect, test } from "./fixtures";
import { openEntity, openStar, signInAs, usedByRows } from "./helpers";

// RP-11 (R-5): Dim Date's "Used by" lists one row per relationship, facts in the order they first relate, each with its
// role and key; a row opens its fact.

test("RP-11: Dim Date's Used by: Fact Sales as Order date and as Ship date, Fact Orders as Order date, with their keys", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await openEntity(page, "Dim Date");
  await expect(usedByRows(page)).toHaveText([
    /^Fact Sales as Order date\s*key date_key$/,
    /^Fact Sales as Ship date\s*key ship_date_key$/,
    /^Fact Orders as Order date\s*key date_key$/,
  ]);
  await usedByRows(page).nth(2).click();
  await expect(page.getByTestId("input-entity-name")).toHaveValue("Fact Orders");
  await openEntity(page, "Dim Product");
  await expect(usedByRows(page)).toHaveText([/^Fact Sales\s*key product_key$/]);
});
