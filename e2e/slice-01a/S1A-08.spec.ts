import { expect, test } from "./fixtures";
import { canvasUrl, card, expectToast, loadModel, mappingLine, openCanvas, pickOption, signInAs } from "./helpers";

test("S1A-08: a mapping gets a second input: it becomes a transform and cannot be saved without a rule; with a rule it saves and shows the ƒ node", async ({ page }) => {
  const before = await loadModel();
  const customer = before.entities.find((e) => e.name === "Customer")!;
  const firstName = before.attributes.find((a) => a.entity_id === customer.id && a.name === "first_name")!;
  const mapping = before.mappings.find((m) => m.attribute_id === firstName.id)!;
  expect(mapping).toMatchObject({ kind: "direct", status: "approved" });

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  await card(page, "Customer").locator(`[data-row="${firstName.id}"]`).click();
  await page.getByTestId("list-attribute-mappings").getByRole("button").first().click();
  const panel = page.getByTestId("panel-mapping");
  await expect(panel.getByTestId("mapping-input")).toHaveCount(1);
  await expect(mappingLine(page, mapping.id).getByTestId("node-f")).toHaveCount(0);

  // a second input: the mapping becomes a transformation and asks for the rule
  await pickOption(panel.getByTestId("select-add-input"), "lname");
  await expect(panel.getByTestId("mapping-input-pending")).toContainText("customers.lname");
  await expect(panel.getByTestId("seg-mapping-kind").locator('[aria-pressed="true"]')).toHaveText("Transformation");
  await expect(panel.getByTestId("note-rule-needed")).toBeVisible();

  // without a rule it is not saved
  await panel.getByTestId("button-save-input").click();
  await expectToast(page, "A mapping with more than one input needs a transformation rule.");
  expect((await loadModel()).mappingInputs.filter((i) => i.mapping_id === mapping.id)).toHaveLength(1);

  // with a rule it saves; a click on an input puts its column into the rule (D-49)
  const rule = panel.getByTestId("input-mapping-rule");
  await rule.fill("CONCAT(fname, ' ', )");
  await rule.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length - 1, el.value.length - 1));
  await panel.getByTestId("mapping-input-pending").getByRole("button").click();
  await expect(rule).toHaveValue("CONCAT(fname, ' ', lname)");
  await panel.getByTestId("button-save-input").click();
  await expectToast(page, "This mapping was approved; your change sends it back to review.");

  await expect(panel.getByTestId("mapping-input")).toHaveCount(2);
  await expect(panel.getByTestId("seg-mapping-kind").locator('[aria-pressed="true"]')).toHaveText("Transformation");
  await expect(panel.getByTestId("seg-mapping-status").locator('[aria-pressed="true"]')).toHaveText("In review");
  await expect(mappingLine(page, mapping.id).getByTestId("node-f")).toHaveCount(1);
  const after = (await loadModel()).mappings.find((m) => m.id === mapping.id)!;
  expect(after).toMatchObject({ kind: "transform", rule_expression: "CONCAT(fname, ' ', lname)", status: "review", approved_by: null });
});
