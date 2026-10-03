import { expect, test } from "./fixtures";
import { canvasUrl, card, loadModel, openCanvas, signInAs } from "./helpers";

test("S1A-09: type check: a varchar(255) column into a string(100) attribute is a type problem with a reason, counted in the status bar; a transform with a rule is not", async ({ page }) => {
  const model = await loadModel();
  const customer = model.entities.find((e) => e.name === "Customer")!;
  const email = model.attributes.find((a) => a.entity_id === customer.id && a.name === "email")!;
  const webEmail = model.sourceColumns.find((c) => c.name === "email" && c.type_length === 255)!;
  const mapping = model.mappings.find((m) => m.attribute_id === email.id && model.mappingInputs.some((i) => i.mapping_id === m.id && i.source_column_id === webEmail.id))!;
  expect(mapping.kind).toBe("direct");

  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl());
  const problems = page.getByTestId("status-type-problems").locator("b");
  const before = Number(await problems.textContent());

  // email becomes string(100): web_users.email varchar(255) no longer fits (customers.email_addr varchar(120) neither)
  await card(page, "Customer").locator(`[data-row="${email.id}"]`).click();
  await page.getByTestId("input-type-length").fill("100");
  await page.getByTestId("input-type-length").press("Enter");
  await expect(card(page, "Customer").locator(`[data-row="${email.id}"]`)).toContainText("String(100)");
  await expect(problems).toHaveText(String(before + 2));

  await page.getByTestId("list-attribute-mappings").getByRole("button").filter({ hasText: "web_users.email" }).click();
  const panel = page.getByTestId("panel-mapping");
  await expect(panel.getByTestId("note-type-check")).toHaveText("varchar(255) does not fit string(100): values can be longer than 100 characters.");
  await expect(page.locator(`[data-mapping="${mapping.id}"]`)).toHaveClass(/\bwarn\b/);

  // a transformation with a rule is never a type problem
  await panel.getByTestId("seg-mapping-kind").getByRole("button", { name: "Transformation" }).click();
  const rule = panel.getByTestId("input-mapping-rule");
  await expect(rule).toBeFocused();
  await rule.fill("LEFT(email, 100)");
  await rule.blur();
  await expect(panel.getByTestId("note-type-check")).toHaveText("The transformation rule handles the conversion.");
  await expect(problems).toHaveText(String(before + 1));
  await expect(page.locator(`[data-mapping="${mapping.id}"]`)).not.toHaveClass(/\bwarn\b/);
  expect((await loadModel()).mappings.find((m) => m.id === mapping.id)).toMatchObject({ kind: "transform", rule_expression: "LEFT(email, 100)" });
});
