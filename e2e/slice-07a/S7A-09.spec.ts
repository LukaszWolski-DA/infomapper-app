import { updateSourceColumn } from "../../src/domain/commands/source";
import { expect, test } from "./fixtures";
import { asPerson, expectToast, imports, loadModel, openWizard, reviewFile, reviewRow, sample, SEED_IDS } from "./helpers";

const snapshot = async () => {
  const m = await loadModel();
  return {
    tables: m.sourceTables.map((t) => [t.id, t.name, t.missing_since]).sort(),
    columns: m.sourceColumns.map((c) => [c.id, c.name, c.data_type, c.type_length, c.ordinal, c.comment, c.missing_since]).sort(),
    mappings: m.mappings.map((x) => [x.id, x.status, x.approved_by, x.rule_expression, x.review_reason]).sort(),
    relationships: m.sourceRelationships.length,
  };
};

test("S7A-09: nothing is written before “Import into”; Cancel and Esc write nothing; the import is one undo step and Undo restores everything", async ({ page }) => {
  const before = await snapshot();
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm.csv", sample("crm_snapshot_2026-10-20.csv"));
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("dialog-import")).toHaveCount(0);
  await page.getByTestId("button-import-sources").click();
  await page.getByTestId("button-wizard-cancel").click();
  await expect(page.getByTestId("dialog-import")).toHaveCount(0);
  expect(await snapshot()).toEqual(before);
  expect(await imports()).toEqual([]);

  await page.getByTestId("button-import-sources").click();
  await reviewFile(page, { existing: "CRM" }, "crm.csv", sample("crm_snapshot_2026-10-20.csv"));
  await page.getByTestId("button-wizard-import").click();
  await expectToast(page, /^Imported into CRM: /, 15_000);
  expect(await snapshot()).not.toEqual(before);
  await page.getByTestId("toast").getByRole("button", { name: "Undo" }).click();
  await expectToast(page, "Undone: Import crm.csv", 15_000);
  expect(await snapshot()).toEqual(before);
  expect(await imports()).toEqual([]);
});

test("S7A-09: P8: a change to the system between review and import writes nothing; the review refreshes, says so, keeps the choices that still apply", async ({ page }) => {
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm.csv", sample("crm_snapshot_2026-10-20.csv"));
  await page.locator('[data-testid="select-rename"][data-key="crmprod|dbo|customers|created_ts"]').selectOption("created_on");
  // meanwhile someone edits a column the import reads
  const m = await loadModel();
  const custNo = m.sourceColumns.find((c) => c.name === "cust_no" && m.sourceTables.find((t) => t.id === c.source_table_id)!.name === "customers")!;
  await asPerson(SEED_IDS.userAnna, (ctx, access) => updateSourceColumn(ctx, access, { column: custNo }, { sourceColumnId: custNo.id, expectedVersion: custNo.version, comment: "Meanwhile" }));

  await page.getByTestId("button-wizard-import").click();
  await expect(page.getByTestId("callout-stale")).toHaveText("CRM changed since you opened this review. The review now shows the current state; check it and import again.");
  await expect(page.getByTestId("dialog-import")).toBeVisible();
  expect(await imports()).toEqual([]);
  // the review shows the current state and keeps the rename choice
  await expect(reviewRow(page, "cust_no")).toContainText("comment: Meanwhile→Customer number shown to the customer");
  await expect(page.locator('[data-testid="select-rename"][data-key="crmprod|dbo|customers|created_ts"]')).toHaveValue("created_on");
  await page.getByTestId("button-wizard-import").click();
  await expectToast(page, /^Imported into CRM: /, 15_000);
  expect(await imports()).toHaveLength(1);
});
