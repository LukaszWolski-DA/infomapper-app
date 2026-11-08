// S18-02 (slice 18, item 1, D-73): on a new attribute of Order Line, "Calculate from attributes…" with two inputs; the
// rule takes the cursor and is saved; the row shows "="; "Add inputs…", × and "Stop calculating"; each one undo step.
// A reviewer and a reader see the section without its controls.

import { expect, test } from "./fixtures";
import {
  addAttributeAs,
  attributeNamed,
  calcSection,
  expectAttributePanelAt,
  expectToast,
  inputsOf,
  liveModel,
  openAttribute,
  openStar,
  pickInputs,
  rowNamed,
  signInAs,
  undoButton,
} from "./helpers";

test("S18-02: calculate a new attribute from two inputs, write its rule, add and remove inputs, stop; each one undo step", async ({ page }) => {
  const id = await addAttributeAs("Order Line", "line_total");
  await signInAs(page, "Łukasz");
  await openStar(page);
  await openAttribute(page, "Order Line", "line_total");
  const section = calcSection(page);
  await expect(section).toContainText("Not calculated. Mark it when its value is computed from other attributes of Order Line.");

  await section.getByTestId("button-calculate").click();
  await pickInputs(page, ["quantity", "unit_price"]);
  await expectToast(page, "line_total is calculated from quantity, unit_price. Write its rule.");
  const rule = section.getByTestId("input-calc-rule");
  await expect(rule).toBeFocused();
  await expect.poll(() => inputsOf(id)).toEqual(["quantity", "unit_price"]);
  await rule.fill("quantity * unit_price");
  await rule.blur();
  await expect.poll(async () => (await attributeNamed("Order Line", "line_total")).calc_rule).toBe("quantity * unit_price");
  // Order Line's quantity and unit_price have no source mapping in the seed (answer 6's texts)
  await expect(section.getByTestId("note-calc-state")).toHaveText("Not yet: quantity, unit_price are not mapped.");
  await expect(section.getByTestId("calc-input-state")).toHaveText(["not mapped", "not mapped"]);
  await expect(rowNamed(page, "Order Line", "line_total").getByTestId("mark-calc")).toHaveAttribute("title", "Calculated: quantity * unit_price");
  await expect(rowNamed(page, "Order Line", "line_total").getByTestId("mark-calc")).toHaveText("=");

  await expectAttributePanelAt(page, id);
  await section.getByTestId("button-calc-add").click();
  await pickInputs(page, ["discount_pct"]);
  await expectToast(page, "line_total reads 1 more attribute.");
  await expect.poll(() => inputsOf(id)).toEqual(["quantity", "unit_price", "discount_pct"]);

  await expectAttributePanelAt(page, id);
  await section.locator('[data-testid="item-calculation-input"]').filter({ hasText: "unit_price" }).getByTestId("button-calc-remove").click();
  await expect.poll(() => inputsOf(id)).toEqual(["quantity", "discount_pct"]);
  await undoButton(page).click();
  await expectToast(page, "Undone: Remove calculation input");
  await expect.poll(() => inputsOf(id)).toEqual(["quantity", "unit_price", "discount_pct"]);

  await expectAttributePanelAt(page, id);
  await section.getByTestId("button-calc-stop").click();
  await expectToast(page, "line_total is no longer calculated.");
  await expect.poll(async () => (await attributeNamed("Order Line", "line_total")).is_calculated).toBe(false);
  await expect(rowNamed(page, "Order Line", "line_total").getByTestId("mark-calc")).toHaveCount(0);
  await undoButton(page).click();
  await expectToast(page, "Undone: Stop calculating");
  await expect.poll(() => inputsOf(id)).toEqual(["quantity", "unit_price", "discount_pct"]);
  await expect.poll(async () => (await attributeNamed("Order Line", "line_total")).calc_rule).toBe("quantity * unit_price");

  // the earlier steps, one each
  for (const step of ["Add calculation inputs", "Change calculation rule", "Calculate attribute"]) {
    await undoButton(page).click();
    await expectToast(page, `Undone: ${step}`);
  }
  await expect.poll(async () => (await attributeNamed("Order Line", "line_total")).is_calculated).toBe(false);
  expect((await liveModel()).attributeInputs.filter((i) => i.attribute_id === id && i.deleted_at === null)).toEqual([]);
});

for (const name of ["Piotr Wiśniewski", "Kasia Zielińska"] as const) {
  test(`S18-02: ${name === "Piotr Wiśniewski" ? "a reviewer" : "a reader"} sees a calculation without controls, and no section on an attribute without one`, async ({ page }) => {
    await signInAs(page, name);
    await openStar(page);
    await openAttribute(page, "Fact Sales", "net_amount");
    const section = calcSection(page);
    await expect(section.getByTestId("item-calculation-input")).toHaveCount(3);
    await expect(section.getByTestId("input-calc-rule")).toHaveAttribute("readonly", "");
    for (const control of ["button-calc-add", "button-calc-remove", "button-calc-stop", "button-calculate"]) await expect(section.getByTestId(control)).toHaveCount(0);
    // an attribute neither calculated nor read by a calculation: no section for them
    await openAttribute(page, "Fact Sales", "order_number");
    await expect(calcSection(page)).toHaveCount(0);
    // an input shows who reads it, without controls
    await openAttribute(page, "Fact Sales", "quantity");
    await expect(calcSection(page).getByTestId("calc-user")).toHaveText(["net_amount"]);
    await expect(calcSection(page).getByTestId("button-calculate")).toHaveCount(0);
  });
}
