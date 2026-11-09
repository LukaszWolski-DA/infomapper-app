// S22-04 (fact and lookup): Fact Sales' Dimensions show "no match → -1" for each key, before "snapshot" where both show;
// a stored key value shows instead of the default; nothing for a dimension turned off. The demo's lookup into Dim
// Customer.country_name has the placeholder "Unknown (the unknown member's value)", "e.g. Unknown" when the dimension's
// unknown member is off.

import { expect, test } from "./fixtures";
import { cubeMappingId, dimensionRow, dimensionRows, hydrated, openCubeMapping, openEntity, openStar, relId, setUnknownAs, setValueAs, signInAs } from "./helpers";

test("S22-04: Fact Sales' Dimensions say what a fact row without a match gets", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openEntity(page, "Fact Sales");
  await expect(dimensionRows(page)).toHaveText([
    /^Dim Customer\s*key customer_key · no match → -1$/,
    /^Dim Product\s*key product_key · no match → -1 · snapshot$/,
    /^Dim Date as Order date\s*key date_key · no match → -1$/,
    /^Dim Date as Ship date\s*key ship_date_key · no match → -1$/,
  ]);
  await expect(dimensionRow(page, relId("cust>sales")).getByTestId("mark-cube-no-match")).toHaveAttribute("title", "A fact row whose customer_key is empty or has no match gets Dim Customer's unknown member");
  await expect(dimensionRow(page, relId("prod>sales")).getByTestId("mark-cube-snapshot")).toBeVisible();

  // a typed key value, and a dimension turned off
  await setValueAs("cust.customer_key", "0");
  await setUnknownAs("prod", false);
  await page.reload();
  await hydrated(page);
  await openEntity(page, "Fact Sales");
  await expect(dimensionRows(page)).toHaveText([
    /^Dim Customer\s*key customer_key · no match → 0$/,
    /^Dim Product\s*key product_key · snapshot$/,
    /^Dim Date as Order date\s*key date_key · no match → -1$/,
    /^Dim Date as Ship date\s*key ship_date_key · no match → -1$/,
  ]);
});

test("S22-04: a lookup's When no match takes the unknown member's value as its placeholder", async ({ page }) => {
  const country = cubeMappingId("cust.country_name");
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  let panel = await openCubeMapping(page, country);
  // the demo's lookup has a stored "Unknown" (acceptance F10): the placeholder is there, behind the value
  await expect(panel.getByTestId("input-cube-lookup-default")).toHaveValue("Unknown");
  await expect(panel.getByTestId("input-cube-lookup-default")).toHaveAttribute("placeholder", "Unknown (the unknown member's value)");

  await setValueAs("cust.country_name", "n/a");
  await page.reload();
  await hydrated(page);
  panel = await openCubeMapping(page, country);
  await expect(panel.getByTestId("input-cube-lookup-default")).toHaveAttribute("placeholder", "n/a (the unknown member's value)");

  await setUnknownAs("cust", false);
  await page.reload();
  await hydrated(page);
  panel = await openCubeMapping(page, country);
  await expect(panel.getByTestId("input-cube-lookup-default")).toHaveAttribute("placeholder", "e.g. Unknown");
});
