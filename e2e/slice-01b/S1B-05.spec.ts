import { addMappingInput } from "../../src/domain/commands/mapping";
import { expect, test } from "./fixtures";
import { asLukasz, canvasUrl, expectToast, ids, LEFT_AT_100, loadModel, openCanvas, rowNamed, signInAs } from "./helpers";

test("S1B-05: split turns a combined mapping into one mapping per input; merge turns two mappings of one attribute into one transform after a rule is given", async ({ page }) => {
  const { model, attribute, column } = await ids();
  // test data: Customer.customer_id also reads customers.cust_no, with a rule (a combined mapping, D-49)
  const customerId = attribute("Customer", "customer_id");
  const combined = model.mappings.find((m) => m.attribute_id === customerId.id)!;
  const custNo = column("customers", "cust_no");
  await asLukasz((ctx, access) =>
    addMappingInput(ctx, access, { mapping: combined, inputs: model.mappingInputs.filter((i) => i.mapping_id === combined.id), column: custNo }, {
      mappingId: combined.id,
      expectedVersion: combined.version,
      sourceColumnId: custNo.id,
      ruleExpression: "COALESCE(cust_id, cust_no)",
    }),
  );
  await signInAs(page, "Łukasz");
  await openCanvas(page, canvasUrl(), LEFT_AT_100);
  const panel = page.getByTestId("panel-mapping");

  // split
  await rowNamed(page, "Customer", "customer_id").click();
  await page.getByTestId("list-attribute-mappings").getByRole("button").first().click();
  await expect(panel.getByTestId("mapping-input")).toHaveCount(2);
  await panel.getByTestId("button-split-mapping").click();
  await expectToast(page, /Split into 2 separate mappings/);
  let after = await loadModel();
  const split = after.mappings.filter((m) => m.attribute_id === customerId.id);
  expect(split).toHaveLength(2);
  const inputsOf = (id: string) => after.mappingInputs.filter((i) => i.mapping_id === id).map((i) => i.source_column_id);
  expect(split.map((m) => inputsOf(m.id).join()).sort()).toEqual([column("customers", "cust_id").id, custNo.id].sort());
  expect(split.every((m) => m.kind === "direct")).toBe(true);

  // merge: Customer.email has two mappings (customers.email_addr and web_users.email); without a rule it is refused
  const email = attribute("Customer", "email");
  await rowNamed(page, "Customer", "email").click();
  await page.getByTestId("list-attribute-mappings").getByRole("button").first().click();
  await panel.getByTestId("button-merge-mappings").click();
  await panel.getByTestId("check-merge-mapping").first().check();
  await panel.getByTestId("input-merge-rule").fill("");
  await panel.getByTestId("button-merge").click();
  await expect(page.getByTestId("toast")).toHaveAttribute("data-kind", "refusal");
  expect((await loadModel()).mappings.filter((m) => m.attribute_id === email.id)).toHaveLength(2);

  await panel.getByTestId("input-merge-rule").fill("COALESCE(email_addr, email)");
  await panel.getByTestId("button-merge").click();
  await expect.poll(async () => (await loadModel()).mappings.filter((m) => m.attribute_id === email.id).length).toBe(1);
  after = await loadModel();
  const merged = after.mappings.find((m) => m.attribute_id === email.id)!;
  expect(merged).toMatchObject({ kind: "transform", status: "review", rule_expression: "COALESCE(email_addr, email)" });
  expect(inputsOf(merged.id)).toHaveLength(2);
});
