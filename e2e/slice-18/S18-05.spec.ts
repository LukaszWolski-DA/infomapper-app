// S18-05 (slice 18, item 3, F10, F12): Focus on a calculated attribute lights its inputs (their feeds and the cards
// they come from); on an input, the attributes calculated from it. Deleting an input: its second click names the
// calculation; afterwards the calculation has one input less; one undo restores both.

import { expect, test } from "./fixtures";
import {
  attributeNamed,
  calculateAs,
  cubeMappingId,
  expectToast,
  hydrated,
  inputsOf,
  litModules,
  openAttribute,
  openStar,
  signInAs,
  undoButton,
  veil,
} from "./helpers";

test("S18-05: Focus on net_amount lights its inputs' feeds and Order Line; on an input, the attribute calculated from it", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openAttribute(page, "Fact Sales", "net_amount");
  await page.getByTestId("button-focus").click();
  // Fact Sales and Order Line, where quantity, unit_price and discount_pct come from; every dimensional line between the
  // two lit cards lights (15c's rule), so product_key's too
  await expect.poll(async () => (await veil(page))?.litCards).toBe(2);
  await expect.poll(() => litModules(page)).toEqual(
    [cubeMappingId("sales.discount_pct"), cubeMappingId("sales.quantity"), cubeMappingId("sales.unit_price"), cubeMappingId("sales.product_key")].sort(),
  );
  await page.getByTestId("button-focus").click();
  await expect.poll(() => veil(page)).toBeNull();

  // Dim Customer: segment_code calculated from city (test data); Focus on city lights segment_code's feed, from Customer,
  // and so every line from Customer and Customer Address to Dim Customer
  await calculateAs("Dim Customer", "segment_code", ["city"]);
  await page.reload();
  await hydrated(page);
  await openAttribute(page, "Dim Customer", "city");
  await page.getByTestId("button-focus").click();
  await expect.poll(() => litModules(page)).toEqual([cubeMappingId("cust.city"), cubeMappingId("cust.customer_number"), cubeMappingId("cust.segment_code")].sort());
});

test("S18-05: deleting an input names the calculation; the calculation loses it; one undo restores both", async ({ page }) => {
  const net = await attributeNamed("Fact Sales", "net_amount");
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);
  await openAttribute(page, "Fact Sales", "discount_pct");
  const del = page.getByTestId("panel-attribute").getByTestId("button-delete-attribute");
  await del.click();
  await expect(del).toHaveAttribute("data-armed", "true");
  await expect(del).toContainText("the calculation of net_amount loses this input");
  await del.click();
  await expect.poll(() => inputsOf(net.id)).toEqual(["quantity", "unit_price"]);
  await undoButton(page).click();
  await expectToast(page, /^Undone: Delete attribute/);
  await expect.poll(() => inputsOf(net.id)).toEqual(["quantity", "unit_price", "discount_pct"]);
  expect((await attributeNamed("Fact Sales", "discount_pct")).deleted_at).toBeNull();
});
