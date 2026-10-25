// S7B-01: raising (PRD items 6–8). Re-importing CRM through the wizard raises the changes to resolve with their
// severity, label and detail; the toast and the stored import carry the counts; a first import of a new system raises
// none. Each kind's rules (rule_updated included, which the test files do not raise) are unit-tested in
// `src/domain/source-changes/raise.test.ts`.

import { expect, test } from "./fixtures";
import { card, crmPartial, imports, importNow, loadChanges, openWizard, reviewFile, sample, systemNamed } from "./helpers";

test("S7B-01: a re-import raises each change with its severity, label and detail; the counts are stored; a first import raises none", async ({ page }) => {
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm_partial.tsv", crmPartial());
  await importNow(page, "Imported into CRM: 7 missing from source, 2 to resolve");
  await page.getByTestId("button-import-sources").click();
  await reviewFile(page, { existing: "CRM" }, "crm_snapshot_2026-10-20.csv", sample("crm_snapshot_2026-10-20.csv"));
  await importNow(page, /, 8 to resolve \(2 high\)$/);

  const crm = (await systemNamed("CRM"))!;
  const second = (await imports(crm.id)).find((i) => i.source_label === "crm_snapshot_2026-10-20.csv")!;
  expect([second.changes_raised, second.changes_high]).toEqual([8, 2]);
  const raised = (await loadChanges()).filter((c) => c.source_import_id === second.id);
  expect(raised.map((c) => c.kind).sort()).toEqual(["business_key_changed", "column_left", "new_column", "new_column", "new_column", "new_table", "new_table", "type_conflict"]);

  // the system panel opens on the import: open changes high first, each with its label and detail
  const panel = page.getByTestId("panel-source-system");
  await expect(panel).toBeVisible();
  const cards = panel.getByTestId("change-card");
  await expect(cards).toHaveCount(9); // customers.segment from the first file, and the eight
  await expect(cards.nth(0)).toHaveAttribute("data-severity", "high");
  await expect(cards.nth(1)).toHaveAttribute("data-severity", "high");
  await expect(cards.nth(2)).toHaveAttribute("data-severity", "normal");
  await expect(card(page, "business_key_changed", "dbo.customers.cust_no").getByTestId("change-detail")).toHaveText(
    "The approved mapping to Customer.customer_number went back to review: business key column changed type, varchar(20) → varchar(25).",
  );
  await expect(card(page, "type_conflict", "dbo.customers.email_addr").getByTestId("change-title")).toHaveText("Mapping no longer fits the source");
  await expect(card(page, "column_left", "dbo.customers.created_ts").getByTestId("change-detail")).toHaveText("Not in the file. Was datetime2(7), with 1 mapping.");
  await expect(card(page, "new_column", "dbo.customers.consent_flag").getByTestId("change-detail")).toHaveText("New in the source, bit.");
  await expect(card(page, "new_table", "dbo.customer_consents").getByTestId("change-detail")).toHaveText("New in the source, 5 columns with no mapping yet.");

  // a first import of a new system raises none
  await page.getByTestId("button-import-sources").click();
  await reviewFile(page, { new: "HR test" }, "hr_snapshot_2026-10-20.csv", sample("hr_snapshot_2026-10-20.csv"));
  await importNow(page, /^Imported into HR test: (?!.*to resolve)/);
  const hr = (await systemNamed("HR test"))!;
  expect((await loadChanges()).filter((c) => c.source_system_id === hr.id)).toHaveLength(0);
  expect((await imports(hr.id))[0]).toMatchObject({ changes_raised: 0, changes_high: 0 });
});
