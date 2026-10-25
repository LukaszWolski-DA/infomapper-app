// S7B-07: Map to an attribute…, Not needed, None of it is needed, Decide column by column (items 14, 15) and Mark as
// needed (P10, item 18), each with its resolution.

import { expect, test } from "./fixtures";
import { act, card, changeOf, column, crmChanges, expectToast, loadChanges, loadModel, openSystem, table, treeItem } from "./helpers";

test("S7B-07: map, not needed and back, none of it needed, decide column by column", async ({ page }) => {
  await crmChanges();
  const model = await loadModel();
  const firstName = model.attributes.find((a) => a.name === "first_name")!;
  await openSystem(page);

  // Map to an attribute… (a draft)
  const consent = card(page, "new_column", "dbo.customers.consent_flag");
  await consent.getByTestId("change-action-map").click();
  await expect(consent.getByTestId("form-map")).toContainText("The mapping starts as a draft.");
  await consent.getByTestId("select-map-attribute").selectOption(firstName.id);
  await consent.getByTestId("button-map").click();
  await expectToast(page, "Mapped to Customer.first_name (draft): dbo.customers.consent_flag");
  const consentFlag = await column("customers", "consent_flag");
  const after = await loadModel();
  const mapped = after.mappings.find((m) => after.mappingInputs.some((i) => i.mapping_id === m.id && i.source_column_id === consentFlag.id))!;
  expect(mapped).toMatchObject({ attribute_id: firstName.id, status: "draft", kind: "direct" });

  // Not needed, then Mark as needed in the column's panel
  await act(page, "new_column", "dbo.customers.customer_segment", "not_needed", "Marked not needed: dbo.customers.customer_segment");
  expect((await column("customers", "customer_segment")).not_needed).toBe(true);
  await treeItem(page, "customers").click();
  const notNeeded = page.getByTestId("list-table-columns").getByRole("button", { name: /^customer_segment/ });
  await expect(notNeeded).toContainText("not needed");
  await notNeeded.click();
  await expect(page.getByTestId("tag-not-needed")).toHaveText("Marked not needed");
  await page.getByTestId("button-mark-needed").click();
  await expectToast(page, "Marked as needed: customer_segment");
  expect((await column("customers", "customer_segment")).not_needed).toBe(false);
  await expect(page.getByTestId("tag-not-needed")).toHaveCount(0);

  // a new table: none of it is needed; decide column by column
  await page.getByTestId("tree-system").filter({ hasText: "CRM" }).getByTestId("button-open-system").click();
  await expect(card(page, "new_table", "dbo.customer_consents").getByTestId("change-action-not_needed")).toHaveText("None of it is needed");
  await act(page, "new_table", "dbo.customer_consents", "not_needed", "Marked not needed: dbo.customer_consents");
  const consents = await table("customer_consents");
  expect((await loadModel()).sourceColumns.filter((c) => c.source_table_id === consents.id).every((c) => c.not_needed)).toBe(true);

  await act(page, "new_table", "stage.customers_load", "split", "Split into one decision per column: stage.customers_load");
  expect((await changeOf("new_table", "customers_load")).resolution).toBe("Split into one decision per column");
  const load = await table("customers_load");
  expect((await loadChanges()).filter((c) => c.kind === "new_column" && c.source_table_id === load.id && c.status === "open")).toHaveLength(3);
  await expect(page.getByTestId("change-card").filter({ hasText: "stage.customers_load." })).toHaveCount(3);
});
