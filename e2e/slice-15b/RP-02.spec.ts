import { expect, test } from "./fixtures";
import { dimensionRows, hintsOk, openEntity, openStar, signInAs } from "./helpers";

// RP-02 (R-2): Fact Sales' Dimensions, one row per relationship with its role and its key; no key hints.

test("RP-02: Fact Sales' Dimensions list one row per relationship with its key, and no hints", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await openEntity(page, "Fact Sales");
  await expect(dimensionRows(page)).toHaveText([
    /^Dim Customer\s*key customer_key\s*no match → -1$/,
    /^Dim Product\s*key product_key\s*no match → -1$/,
    /^Dim Date as Order date\s*key date_key\s*no match → -1$/,
    /^Dim Date as Ship date\s*key ship_date_key\s*no match → -1$/,
  ]);
  await expect(page.getByTestId("button-cube-add-key")).toHaveCount(0);
  await expect(hintsOk(page)).toBeVisible();
});
