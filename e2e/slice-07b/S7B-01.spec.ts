// S7B-01: raising (PRD items 6–8). Re-importing CRM through the wizard raises the changes to resolve with their
// severity, label and detail; the toast and the stored import carry the counts; a first import of a new system raises
// none. A rename the modeller picks in the review raises rule_updated for an approved mapping whose rule names the
// column (Łukasz's answer to step 6). Each kind's rules are unit-tested in `src/domain/source-changes/raise.test.ts`.

import { setMappingStatus } from "../../src/domain/commands/mapping";
import { expect, test } from "./fixtures";
import { asPerson, card, crmPartial, imports, importNow, loadChanges, loadModel, openWizard, reviewFile, reviewRow, sample, SEED_IDS, systemNamed } from "./helpers";

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

test("S7B-01: renaming a column an approved mapping's rule names raises “Rule updated for a renamed column”", async ({ page }) => {
  // the seed's Customer.created_at ← customers.created_ts, rule CAST(created_ts AS date), approved by Piotr
  const before = await loadModel();
  const created = before.sourceColumns.find((c) => c.name === "created_ts")!;
  const mappingId = before.mappingInputs.find((i) => i.source_column_id === created.id && i.deleted_at === null)!.mapping_id;
  const m = before.mappings.find((x) => x.id === mappingId)!;
  expect(m.rule_expression).toBe("CAST(created_ts AS date)");
  await asPerson(SEED_IDS.userPiotr, (ctx, access) =>
    setMappingStatus(ctx, access, { mapping: m, contentAuthorId: SEED_IDS.userAnna }, { mappingId: m.id, expectedVersion: m.version, status: "approved" }),
  );

  // the changed CRM file, with created_ts renamed to created_on in the review
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm_snapshot_2026-10-20.csv", sample("crm_snapshot_2026-10-20.csv"));
  await page.locator('[data-testid="select-rename"][data-key="crmprod|dbo|customers|created_ts"]').selectOption("created_on");
  await expect(reviewRow(page, "created_on")).toContainText("its rule now reads CAST(created_on AS date)");
  await importNow(page, /to resolve/);

  const change = (await loadChanges()).find((c) => c.kind === "rule_updated")!;
  expect(change).toMatchObject({ severity: "normal", status: "open", mapping_id: mappingId, source_column_id: created.id });
  expect((await loadModel()).mappings.find((x) => x.id === mappingId)).toMatchObject({ status: "review", rule_expression: "CAST(created_on AS date)" });
  const rule = card(page, "rule_updated", change.object_label);
  await expect(rule.getByTestId("change-title")).toHaveText("Rule updated for a renamed column");
  await expect(rule.getByTestId("change-detail")).toHaveText("The approved mapping to Customer.created_at went back to review: its rule now reads CAST(created_on AS date).");
  await expect(rule).toHaveAttribute("data-severity", "normal");
  await expect(rule.getByTestId("change-action-approve")).toBeVisible();
});
