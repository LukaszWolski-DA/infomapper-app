// S18-03 (slice 18, item 1, F7): no cycle, same entity. Fact Sales.net_amount is calculated from quantity (the demo):
// on quantity's picker net_amount is shown done and cannot be chosen; the domain refuses a cycle and an input of another
// entity sent directly.

import { calculateAttribute, cycleRefusal, SAME_ENTITY } from "../../src/domain/commands/derivation";
import { expect, test } from "./fixtures";
import { asLukasz, attributeNamed, calcPicker, calcSection, liveModel, openAttribute, openStar, pickItem, signInAs } from "./helpers";

test("S18-03: an attribute calculated from quantity is done on quantity's picker; the domain refuses a cycle and another entity's input", async ({ page }) => {
  await signInAs(page, "Łukasz");
  await openStar(page);
  await openAttribute(page, "Fact Sales", "quantity");
  await calcSection(page).getByTestId("button-calculate").click();
  const picker = await calcPicker(page);
  await expect(pickItem(picker, "net_amount")).toBeDisabled();
  await expect(pickItem(picker, "net_amount")).toHaveAttribute("title", "Already an input, or calculated from this attribute");
  await expect(pickItem(picker, "unit_price")).toBeEnabled();
  // the attribute itself is not offered; nothing of another entity is
  await expect(pickItem(picker, "quantity")).toHaveCount(0);
  await expect(pickItem(picker, "segment_code")).toHaveCount(0);
  await page.keyboard.press("Escape");

  const quantity = await attributeNamed("Fact Sales", "quantity");
  const net = await attributeNamed("Fact Sales", "net_amount");
  const segment = await attributeNamed("Dim Customer", "segment_code");
  const state = async () => {
    const m = await liveModel();
    return { attribute: m.attributes.find((a) => a.id === quantity.id)!, attributes: m.attributes, attributeInputs: m.attributeInputs };
  };
  const s = await state();
  await expect(asLukasz((ctx, access) => calculateAttribute(ctx, access, s, { attributeId: quantity.id, expectedVersion: quantity.version, inputIds: [net.id] }))).rejects.toThrow(
    cycleRefusal("net_amount", "quantity"),
  );
  await expect(asLukasz((ctx, access) => calculateAttribute(ctx, access, s, { attributeId: quantity.id, expectedVersion: quantity.version, inputIds: [segment.id] }))).rejects.toThrow(SAME_ENTITY);
  expect((await attributeNamed("Fact Sales", "quantity")).is_calculated).toBe(false);
});
