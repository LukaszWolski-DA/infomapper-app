// S7B-10: undo (P5, item 19): each action is one undo step that brings back the change's status and what it wrote
// (columns, mappings, inputs, the changes it raised or settled). “Approve again all” is undone in S7B-09.

import { expect, test } from "./fixtures";
import { act, card, changeOf, column, crmChanges, expectToast, loadChanges, loadModel, openSystem, table, undo } from "./helpers";

const isOpen = async (kind: Parameters<typeof changeOf>[0], label: string) => (await changeOf(kind, label)).status === "open";

test("S7B-10: every action on a change undoes in one step, the change open again", async ({ page }) => {
  await crmChanges();
  const createdTs = await column("customers", "created_ts");
  await openSystem(page);

  // retire
  await act(page, "column_left", "dbo.customers.created_ts", "retire", /^Retired: kept as historical/);
  await undo(page);
  await expect.poll(() => isOpen("column_left", "customers.created_ts")).toBe(true);
  expect((await column("customers", "created_ts")).retired_since).toBeNull();

  // move: the input, the rule and the target's change come back
  const c = card(page, "column_left", "dbo.customers.created_ts");
  await c.getByTestId("change-action-move").click();
  await c.getByTestId("select-move-target").selectOption({ label: "created_on · datetime2(7)" });
  await c.getByTestId("button-move").click();
  await expectToast(page, /^Mappings moved to/);
  await undo(page);
  await expect.poll(() => isOpen("column_left", "customers.created_ts")).toBe(true);
  expect(await isOpen("new_column", "customers.created_on")).toBe(true);
  const model = await loadModel();
  const input = model.mappingInputs.find((i) => i.source_column_id === createdTs.id)!;
  expect(model.mappings.find((m) => m.id === input.mapping_id)!.rule_expression).toBe("CAST(created_ts AS date)");

  // delete: the column and its mapping come back
  await card(page, "column_left", "dbo.customers.created_ts").getByTestId("change-action-delete").click();
  await page.getByTestId("button-delete-confirm").click();
  await expectToast(page, /^Deleted from the model/);
  await undo(page);
  await expect.poll(() => isOpen("column_left", "customers.created_ts")).toBe(true);
  expect((await loadModel()).mappings.some((m) => m.id === input.mapping_id)).toBe(true);

  // not needed
  await act(page, "new_column", "dbo.customers.customer_segment", "not_needed", /^Marked not needed/);
  await undo(page);
  await expect.poll(() => isOpen("new_column", "customers.customer_segment")).toBe(true);
  expect((await column("customers", "customer_segment")).not_needed).toBe(false);

  // decide column by column: the table's change open, the column changes gone
  await act(page, "new_table", "stage.customers_load", "split", /^Split into one decision per column/);
  await undo(page);
  await expect.poll(() => isOpen("new_table", "customers_load")).toBe(true);
  const load = await table("customers_load");
  expect((await loadChanges()).filter((x) => x.kind === "new_column" && x.source_table_id === load.id)).toHaveLength(0);

  // approve again, leave in review
  await act(page, "business_key_changed", "dbo.customers.cust_no", "approve", /^Approved again/);
  await undo(page);
  await expect.poll(() => isOpen("business_key_changed", "customers.cust_no")).toBe(true);
  await act(page, "type_conflict", "dbo.customers.email_addr", "leave", /^Left in review/);
  await undo(page);
  await expect.poll(() => isOpen("type_conflict", "customers.email_addr")).toBe(true);
  await expect(page.getByTestId("change-card")).toHaveCount(9);
});
