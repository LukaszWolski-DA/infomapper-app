import { expect, test } from "./fixtures";
import {
  attributeIdOf,
  attrId,
  cubeInputsOf,
  cubeMappingId,
  cubeMappingRow,
  expectCubePanelAt,
  hydrated,
  openCubeMapping,
  openStar,
  recordToasts,
  signInAs,
  toasts,
  undoButton,
} from "./helpers";

// S15-20 (B-4, X2, X5, O12; prototype `insCmap`): the dimensional mapping's panel. On segment_code's approved direct
// copy: the note alone keeps the approval; a second input makes it a transformation, sends it back to review with
// D-51's notice and puts the cursor in the rule. On net_amount: × removes one of its three inputs (none on a last
// input). On city's Draft: Transformation puts the cursor in the rule and the rule is saved; the target is re-pointed.
// Each is one undo step.

const BACK = "This mapping was approved; your change sends it back to review.";

test("S15-20: the note keeps the approval; a second input, × , the kind, the rule and the target; one undo each", async ({ page }) => {
  await recordToasts(page);
  await signInAs(page, "Łukasz");
  await openStar(page);
  await hydrated(page);

  // the note alone keeps an approved mapping approved (D-51's first rule)
  const segment = cubeMappingId("cust.segment_code");
  const panel = await openCubeMapping(page, segment);
  await expect(panel.getByTestId("cube-mapping-trace")).toContainText("segment_code");
  await panel.getByTestId("input-cube-note").fill("Checked with sales.");
  await panel.getByTestId("input-cube-note").press("Tab");
  await expect.poll(async () => [(await cubeMappingRow(segment))?.note, (await cubeMappingRow(segment))?.status]).toEqual(["Checked with sales.", "approved"]);
  await undoButton(page).click();
  await expect.poll(async () => (await cubeMappingRow(segment))?.note).toBeNull();
  await expectCubePanelAt(page, segment);

  // a second input: a transformation, back to review, the cursor in the rule (X2)
  const number = await attributeIdOf("Customer", "customer_number");
  await panel.getByTestId("select-add-cube-input").selectOption(number);
  await expect.poll(async () => [(await cubeMappingRow(segment))?.kind, (await cubeMappingRow(segment))?.status]).toEqual(["transform", "review"]);
  expect(await cubeInputsOf(segment)).toEqual([await attributeIdOf("Customer", "segment_code"), number]);
  await expect(panel.getByTestId("cube-input")).toHaveText(["Customer.segment_code×", "Customer.customer_number×"]);
  await expect(page.locator("#f-crule")).toBeFocused();
  // one toast: the panel's own text, then D-51's notice
  await expect.poll(() => toasts(page)).toContain(`It reads Customer.customer_number too, so it is a transformation now. Describe the rule. ${BACK}`);
  await page.locator("#f-crule").blur();
  await undoButton(page).click();
  await expect.poll(async () => [(await cubeMappingRow(segment))?.kind, (await cubeMappingRow(segment))?.status, (await cubeMappingRow(segment))?.approved_by]).toEqual([
    "direct",
    "approved",
    expect.any(String),
  ]);
  expect(await cubeInputsOf(segment)).toHaveLength(1);
  await expect(panel.getByTestId("button-remove-cube-input")).toHaveCount(0);

  // × on one of net_amount's three inputs; its last input has none
  const net = cubeMappingId("sales.net_amount");
  const netPanel = await openCubeMapping(page, net);
  await expect(netPanel.getByTestId("button-remove-cube-input")).toHaveCount(3);
  await netPanel.getByTestId("button-remove-cube-input").nth(2).click();
  await expect.poll(() => cubeInputsOf(net)).toHaveLength(2);
  await expect(netPanel.getByTestId("cube-input")).toHaveCount(2);
  await undoButton(page).click();
  await expect.poll(() => cubeInputsOf(net)).toHaveLength(3);

  // city's Draft: Transformation puts the cursor in the rule; the rule is saved on leaving it
  const city = cubeMappingId("cust.city");
  const cityPanel = await openCubeMapping(page, city);
  await cityPanel.getByTestId("seg-cube-kind").getByText("Transformation", { exact: true }).click();
  await expect.poll(async () => (await cubeMappingRow(city))?.kind).toBe("transform");
  await expect(page.locator("#f-crule")).toBeFocused();
  await page.locator("#f-crule").fill("Latest billing address");
  await page.locator("#f-crule").press("Tab");
  await expect.poll(async () => (await cubeMappingRow(city))?.rule_expression).toBe("Latest billing address");
  await undoButton(page).click();
  await expect.poll(async () => (await cubeMappingRow(city))?.rule_expression).toBeNull();
  await undoButton(page).click();
  await expect.poll(async () => (await cubeMappingRow(city))?.kind).toBe("direct");
  await expectCubePanelAt(page, city);

  // the target re-pointed (X5): its toast, one undo
  await cityPanel.getByTestId("select-cube-target").selectOption(attrId("cust.country_name"));
  await expect.poll(async () => (await cubeMappingRow(city))?.attribute_id).toBe(attrId("cust.country_name"));
  await expect.poll(() => toasts(page)).toContain("Re-pointed to Dim Customer.country_name");
  await undoButton(page).click();
  await expect.poll(async () => (await cubeMappingRow(city))?.attribute_id).toBe(attrId("cust.city"));
});
