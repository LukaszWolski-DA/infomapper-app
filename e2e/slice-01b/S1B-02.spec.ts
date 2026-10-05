import { expect, test } from "./fixtures";
import { canvasUrl, dragTo, ids, loadModel, openCanvas, rowNamed, signInAs } from "./helpers";

test("S1B-02: web_users.cust_no onto Customer.customer_number pre-selects “Separate mapping” and Enter creates a second mapping; customers.lname onto an attribute mapped from customers.fname pre-selects “Add to mapping” and asks for a rule", async ({ page }) => {
  const { attribute, column } = await ids();
  const number = attribute("Customer", "customer_number"), first = attribute("Customer", "first_name");
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), { x: 0, y: -20, zoom: 0.8 });
  const choice = page.getByTestId("popover-map-choice");
  const selected = choice.locator('[data-testid="option-map-choice"][aria-selected="true"]');

  // another system: a separate mapping (alternative source) is pre-selected
  await dragTo(page, rowNamed(page, "web_users", "cust_no"), rowNamed(page, "Customer", "customer_number"));
  await expect(choice).toBeVisible();
  await expect(selected).toHaveText("Separate mapping (alternative source)");
  await expect(choice.getByTestId("option-map-choice")).toHaveText(["Separate mapping (alternative source)", "Add to mapping customers.cust_no"]);
  await page.keyboard.press("Enter");
  await expect(choice).toHaveCount(0);
  await expect.poll(async () => (await loadModel()).mappings.filter((m) => m.attribute_id === number.id).length).toBe(2);
  const model = await loadModel();
  const added = model.mappings.find((m) => m.attribute_id === number.id && model.mappingInputs.some((i) => i.mapping_id === m.id && i.source_column_id === column("web_users", "cust_no").id))!;
  expect(added.kind).toBe("direct");

  // the same source table: “Add to mapping” is pre-selected, and the second input needs a rule
  await dragTo(page, rowNamed(page, "customers", "lname"), rowNamed(page, "Customer", "first_name"));
  await expect(selected).toHaveText("Add to mapping customers.fname");
  await page.keyboard.press("Enter");
  const panel = page.getByTestId("panel-mapping");
  await expect(panel.getByTestId("mapping-input-pending")).toContainText("customers.lname");
  await expect(panel.getByTestId("note-rule-needed")).toBeVisible();
  await panel.getByTestId("input-mapping-rule").fill("CONCAT(fname, ' ', lname)");
  await panel.getByTestId("button-save-input").click();
  await expect(panel.getByTestId("mapping-input-pending")).toHaveCount(0);
  const after = await loadModel();
  const mapping = after.mappings.filter((m) => m.attribute_id === first.id);
  expect(mapping).toHaveLength(1);
  expect(mapping[0]).toMatchObject({ kind: "transform", rule_expression: "CONCAT(fname, ' ', lname)" });
  expect(after.mappingInputs.filter((i) => i.mapping_id === mapping[0]!.id).map((i) => i.source_column_id)).toEqual([
    column("customers", "fname").id,
    column("customers", "lname").id,
  ]);
});
