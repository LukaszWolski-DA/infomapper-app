import { expect, test } from "./fixtures";
import { importNow, loadModel, openWizard, reviewFile, reviewRow, sample } from "./helpers";

const columnsOf = async (table: string) => {
  const m = await loadModel();
  const t = m.sourceTables.find((x) => x.name === table)!;
  return { m, cols: m.sourceColumns.filter((c) => c.source_table_id === t.id) };
};

test("S7A-07: the suggested rename is pre-selected; “renamed to” keeps the column, its mappings, labels, requirement links and flags; one new column is paired once", async ({ page }) => {
  const before = await columnsOf("customers");
  const dob = before.cols.find((c) => c.name === "dob")!;
  const created = before.cols.find((c) => c.name === "created_ts")!;
  const createdMapping = before.m.mappingInputs.find((i) => i.source_column_id === created.id)!.mapping_id;

  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm.csv", sample("crm_snapshot_2026-10-20.csv"));
  const dobChoice = page.locator('[data-testid="select-rename"][data-key="crmprod|dbo|customers|dob"]');
  await expect(dobChoice).toHaveValue("date_of_birth");
  await expect(dobChoice.locator("option:checked")).toHaveText("It was renamed to date_of_birth (suggested: same position and type)");
  const createdChoice = page.locator('[data-testid="select-rename"][data-key="crmprod|dbo|customers|created_ts"]');
  await createdChoice.selectOption("created_on");
  await expect(reviewRow(page, "created_on")).toHaveAttribute("data-status", "rename");
  // created_on is paired: dob is no longer offered it
  await expect(dobChoice.locator("option", { hasText: "created_on" })).toHaveCount(0);
  await expect(reviewRow(page, "created_on")).toContainText("its rule now reads CAST(created_on AS date)");
  await importNow(page, /1 changed column|renamed column/);

  const after = await columnsOf("customers");
  expect(after.cols.find((c) => c.name === "date_of_birth")).toMatchObject({ id: dob.id, is_pii: dob.is_pii, missing_since: null });
  expect(after.cols.find((c) => c.name === "created_on")!.id).toBe(created.id);
  expect(after.m.mappingInputs.find((i) => i.mapping_id === createdMapping)!.source_column_id).toBe(created.id);
  expect(after.m.mappings.find((m) => m.id === createdMapping)).toMatchObject({ rule_expression: "CAST(created_on AS date)", status: "review", review_reason: null });
});

test("S7A-07: “It was removed from the source” marks the column missing and adds the new one", async ({ page }) => {
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm.csv", sample("crm_snapshot_2026-10-20.csv"));
  await page.locator('[data-testid="select-rename"][data-key="crmprod|dbo|customers|dob"]').selectOption("");
  await expect(reviewRow(page, "dob")).toHaveAttribute("data-status", "missing");
  await expect(reviewRow(page, "dob")).toContainText("the mapping stays, on a column that is gone");
  await expect(reviewRow(page, "date_of_birth")).toHaveAttribute("data-status", "new");
  await importNow(page, /^Imported into CRM: /);
  const after = await columnsOf("customers");
  expect(after.cols.find((c) => c.name === "dob")!.missing_since).not.toBeNull();
  expect(after.cols.find((c) => c.name === "date_of_birth")!.missing_since).toBeNull();
});
