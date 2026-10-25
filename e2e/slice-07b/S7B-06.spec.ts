// S7B-06: delete (P5, D-47, item 13; step 1 answer Q7). The form lists what goes with a column or a table before
// anything happens, with the coverage change; Cancel changes nothing; Delete removes them and settles every change on
// the object. The table panel's “Delete table…” is the same cascade and form, now for mapped tables too.

import { expect, test } from "./fixtures";
import { card, changeOf, column, crmChanges, crmPartial, expectToast, importAs, loadChanges, loadModel, openSystem, SEED_IDS, table, treeItem } from "./helpers";

test("S7B-06: a change's Delete… shows what goes, Cancel keeps it, Delete removes the column with its mapping", async ({ page }) => {
  await crmChanges();
  const createdTs = await column("customers", "created_ts");
  const mappingId = (await loadModel()).mappingInputs.find((i) => i.source_column_id === createdTs.id)!.mapping_id;
  await openSystem(page);
  const c = card(page, "column_left", "dbo.customers.created_ts");

  await c.getByTestId("change-action-delete").click();
  const form = c.getByTestId("form-delete");
  await expect(form).toContainText("Delete the column dbo.customers.created_ts with:");
  await expect(form.getByTestId("delete-mappings")).toHaveText("1 mapping: Customer.created_at (in review)");
  await expect(form).toContainText("Retiring keeps the history instead; in Data Vault the column stays in its satellite.");
  await expect(form.getByTestId("delete-coverage").or(form.getByTestId("delete-coverage-none"))).toBeVisible();
  await form.getByTestId("button-form-cancel").click();
  await expect(form).toHaveCount(0);
  expect((await column("customers", "created_ts")).id).toBe(createdTs.id);

  await c.getByTestId("change-action-delete").click();
  await c.getByTestId("button-delete-confirm").click();
  await expectToast(page, "Deleted from the model: dbo.customers.created_ts");
  const model = await loadModel();
  expect(model.sourceColumns.some((x) => x.id === createdTs.id)).toBe(false);
  expect(model.mappings.some((m) => m.id === mappingId)).toBe(false);
  expect((await changeOf("column_left", "customers.created_ts")).resolution).toBe("Deleted from the model");
});

test("S7B-06: Delete table… on a mapped table lists mappings, relationships, columns, cards and coverage, then deletes them", async ({ page }) => {
  await crmChanges();
  const customers = await table("customers");
  await openSystem(page);
  await treeItem(page, "customers").click();
  const panel = page.getByTestId("panel-source-table");
  await panel.getByTestId("button-delete-table").click();
  const form = panel.getByTestId("form-delete");
  await expect(form).toContainText("Delete the table dbo.customers with:");
  await expect(form.getByTestId("delete-mappings")).toContainText("7 mappings: Customer.customer_id (approved)");
  await expect(form.getByTestId("delete-relationships")).toContainText("2 relationships");
  await expect(form.getByTestId("delete-columns")).toHaveText("12 columns");
  await expect(form.getByTestId("delete-canvases")).toHaveText("its cards on Customer & orders");
  await expect(form.getByTestId("delete-coverage")).toContainText("REQ-101");
  await expect(form.getByTestId("delete-coverage")).toContainText("→ 0 of");
  await form.getByTestId("button-form-cancel").click();
  expect((await table("customers")).id).toBe(customers.id);

  await panel.getByTestId("button-delete-table").click();
  await panel.getByTestId("button-delete-confirm").click();
  await expectToast(page, "Deleted customers with its 12 columns.");
  const model = await loadModel();
  expect(model.sourceTables.some((t) => t.id === customers.id)).toBe(false);
  expect(model.mappings.filter((m) => model.attributes.find((a) => a.id === m.attribute_id)?.name === "first_name")).toHaveLength(0);
  // every open change on the table and its columns settled
  const left = (await loadChanges()).filter((c) => c.source_table_id === customers.id);
  expect(left.length).toBeGreaterThan(0);
  expect(left.every((c) => c.status === "resolved" && c.resolution!.startsWith("Settled: the"))).toBe(true);
});

test("S7B-06: a table that left the source is deleted from its change", async ({ page }) => {
  await importAs(SEED_IDS.userLukasz, "CRM", "crm_partial.tsv", crmPartial());
  const addresses = await table("customer_addresses");
  await openSystem(page);
  const c = card(page, "table_left", "dbo.customer_addresses");
  await c.getByTestId("change-action-delete").click();
  await expect(c.getByTestId("form-delete")).toContainText("Delete the table dbo.customer_addresses with:");
  await c.getByTestId("button-delete-confirm").click();
  await expectToast(page, "Deleted from the model: dbo.customer_addresses");
  expect((await loadModel()).sourceTables.some((t) => t.id === addresses.id)).toBe(false);
  expect((await changeOf("table_left", "customer_addresses")).resolution).toBe("Deleted from the model");
});
