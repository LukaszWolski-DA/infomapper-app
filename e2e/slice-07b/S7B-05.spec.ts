// S7B-05: “Move its mappings…” (item 12; step 1 answers Q5 and question 8). A combined mapping moves that input only,
// and goes back to review with the reason; the form says beforehand when the input is removed instead; a direct
// mapping's rule is rewritten; the old column is retired; the target's “new column” change settles.

import { addMappingInput, setMappingStatus } from "../../src/domain/commands/mapping";
import { expect, test } from "./fixtures";
import { asPerson, card, changeOf, column, crmChanges, expectToast, loadModel, openSystem, SEED_IDS, treeItem } from "./helpers";

const { userLukasz: LUKASZ, userAnna: ANNA } = SEED_IDS;

test("S7B-05: moving a combined mapping's input and a direct mapping onto present columns", async ({ page }) => {
  await crmChanges();
  // test data: Customer.first_name reads customers.fname and customers.segment (left the source), approved
  let model = await loadModel();
  const firstName = model.attributes.find((a) => a.name === "first_name")!;
  const segment = await column("customers", "segment");
  let combined = model.mappings.find((m) => m.attribute_id === firstName.id)!;
  await asPerson(LUKASZ, (ctx, access) =>
    addMappingInput(ctx, access, { mapping: combined, inputs: model.mappingInputs.filter((i) => i.mapping_id === combined.id), column: segment }, {
      mappingId: combined.id,
      expectedVersion: combined.version,
      sourceColumnId: segment.id,
      ruleExpression: "COALESCE(fname, segment)",
    }),
  );
  model = await loadModel();
  combined = model.mappings.find((m) => m.id === combined.id)!;
  await asPerson(ANNA, (ctx, access) => setMappingStatus(ctx, access, { mapping: combined, contentAuthorId: LUKASZ }, { mappingId: combined.id, expectedVersion: combined.version, status: "approved" }));
  const segmentInput = (await loadModel()).mappingInputs.find((i) => i.source_column_id === segment.id)!;

  await openSystem(page);
  const c = card(page, "column_left", "dbo.customers.segment");
  await c.getByTestId("change-action-move").click();
  const form = c.getByTestId("form-move");
  // onto a column the mapping already reads: the form says the input is removed (question 8)
  await form.getByTestId("select-move-target").selectOption({ label: "fname · nvarchar(50)" });
  await expect(form.getByTestId("move-step")).toContainText("Customer.first_name already reads fname; the input from segment is removed.");
  await form.getByTestId("select-move-target").selectOption({ label: "customer_segment · varchar(3)" });
  await expect(form.getByTestId("move-step")).toHaveText("Customer.first_name (approved), goes back to review; rule COALESCE(fname, customer_segment)");
  await expect(form).toContainText("Moved approved mappings go back to review; the old column is retired.");
  await form.getByTestId("button-move").click();
  await expectToast(page, "Mappings moved to customers.customer_segment: dbo.customers.segment");

  const customerSegment = await column("customers", "customer_segment");
  model = await loadModel();
  const moved = model.mappings.find((m) => m.id === combined.id)!;
  expect(moved).toMatchObject({ status: "review", review_reason: "moved from segment after it left the source", rule_expression: "COALESCE(fname, customer_segment)" });
  // that input only, the same row pointed at the new column
  expect(model.mappingInputs.filter((i) => i.mapping_id === moved.id).map((i) => i.source_column_id).sort()).toEqual([(await column("customers", "fname")).id, customerSegment.id].sort());
  expect(model.mappingInputs.find((i) => i.id === segmentInput.id)!.source_column_id).toBe(customerSegment.id);
  expect((await column("customers", "segment")).retired_since).not.toBeNull();
  expect(await changeOf("new_column", "customers.customer_segment")).toMatchObject({ status: "resolved", resolution: "Settled: mappings moved here from segment" });
  expect((await changeOf("column_left", "customers.segment")).resolution).toBe("Mappings moved to customers.customer_segment");

  // a direct mapping with a rule: created_ts onto created_on
  const d = card(page, "column_left", "dbo.customers.created_ts");
  await d.getByTestId("change-action-move").click();
  await d.getByTestId("select-move-target").selectOption({ label: "created_on · datetime2(7)" });
  await expect(d.getByTestId("move-step")).toHaveText("Customer.created_at (in review); rule CAST(created_on AS date)");
  await d.getByTestId("button-move").click();
  await expectToast(page, "Mappings moved to customers.created_on: dbo.customers.created_ts");
  model = await loadModel();
  const createdOn = await column("customers", "created_on");
  const direct = model.mappings.find((m) => model.mappingInputs.some((i) => i.mapping_id === m.id && i.source_column_id === createdOn.id))!;
  expect(direct).toMatchObject({ status: "review", rule_expression: "CAST(created_on AS date)" });
  expect((await changeOf("new_column", "customers.created_on")).status).toBe("resolved");

  // the mapping panel says why it is in review (F9)
  await treeItem(page, "customers").click();
  await page.getByTestId("list-table-columns").getByRole("button", { name: /^customer_segment/ }).click();
  await page.getByTestId("panel-source-column").getByRole("button", { name: /Customer\.first_name/ }).click();
  await expect(page.getByTestId("note-review-reason")).toHaveText("Sent back to review after a source change: moved from segment after it left the source.");
});
