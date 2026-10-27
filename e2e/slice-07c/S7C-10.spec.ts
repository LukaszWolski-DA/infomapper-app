// S7C-10: reading the file: codes and names of the whole list read; an unknown value warns and is ignored; with the
// mode off, Data Vault values are read and marked in the review; the "not read yet" warning is gone; a re-import never
// changes classifications and says "The file says …; your classifications are kept."

import { expect, test } from "./fixtures";
import { filterCount, imports, systemNamed } from "../slice-07a/helpers";
import { classesOf, fileOf, importNow, loadModel, openWizard, reviewFile, reviewRow, sample } from "./helpers";

const columnOf = async (system: string, table: string, column: string) => {
  const m = await loadModel();
  const sys = m.sourceSystems.find((s) => s.name === system)!;
  const t = m.sourceTables.find((x) => x.source_system_id === sys.id && x.name === table)!;
  return m.sourceColumns.find((c) => c.source_table_id === t.id && c.name === column)!.id;
};

const FILE = fileOf([
  ["t", "a", "int", { pk: true, cls: "bk" }],
  ["t", "b", "varchar(10)", { cls: "Personal_Data; load-date" }],
  ["t", "c", "int", { cls: "TECH | Effective date" }],
  ["t", "d", "int", { cls: "Master data" }],
  ["t", "e", "int", { cls: "XYZ" }],
  ["t", "f", "int", { cls: "xyz" }],
  ["t", "g", "int", { cls: "LK" }],
]);

/** The CRM file with fname called a technical column instead of personal data. */
const crmWithFnameTech = () =>
  sample("crm_snapshot_2026-10-20.csv")
    .split(/\r?\n/)
    .map((l) => (l.includes(",customers,") && l.includes(",fname,") ? l.replace(/PII$/, "TECH") : l))
    .join("\n");

test("S7C-10: codes and names read, unknown values and a table classification warned, Data Vault ones marked while the mode is off", async ({ page }) => {
  await openWizard(page);
  await reviewFile(page, { new: "Feed" }, "feed.csv", FILE);
  const chips = (column: string) => reviewRow(page, column).getByTestId("review-classification");
  await expect(chips("a")).toHaveText(["Business key"]);
  await expect(chips("b")).toHaveText(["Personal data", "Load date"]);
  await expect(chips("c")).toHaveText(["Technical / audit", "Effective date"]);
  await expect(chips("d")).toHaveCount(0);
  await expect(chips("g")).toHaveText(["Link keyData Vault 2.0hidden while Data Vault 2.0 mode is off"]);
  const warnings = page.getByTestId("review-warnings");
  await expect(warnings).toContainText("“Master data” is a table classification; ignored on s.t.d (row 5).");
  await expect(warnings).toContainText(
    "Unknown classification “XYZ” on s.t.e (row 6; 1 more row in this table), ignored. Add it to the classification list (“Edit the list…” in a table or column panel) to use it.",
  );
  await expect(warnings).not.toContainText("not read yet");
  await importNow(page, /^Imported into Feed: /);
  expect(await classesOf(await columnOf("Feed", "t", "b"))).toEqual(["PII", "LDTS"]);
  expect(await classesOf(await columnOf("Feed", "t", "g"))).toEqual(["LK"]);
  expect(await classesOf(await columnOf("Feed", "t", "e"))).toEqual([]);
});

test("S7C-10: the CRM file's TECH, Effective date and Load date are read; a re-import keeps the modeller's and says what the file says", async ({ page }) => {
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm_snapshot_2026-10-20.csv", sample("crm_snapshot_2026-10-20.csv"));
  await expect(page.getByTestId("review-warnings")).not.toContainText("TECH");
  await importNow(page, /^Imported into CRM: /);
  // fname is Personal data (seed and file); a file that calls it a technical column changes nothing and says so
  const fname = await columnOf("CRM", "customers", "fname");
  const before = await classesOf(fname);
  expect(before).toEqual(["PII"]);
  await page.getByTestId("button-import-sources").click();
  await reviewFile(page, { existing: "CRM" }, "crm_again.csv", crmWithFnameTech());
  // fname is unchanged otherwise, and still shown: its file says something else
  await expect(page.locator('[data-testid="review-row"][data-column="fname"]').getByTestId("review-file-says")).toHaveText("The file says Technical / audit; your classifications are kept.");
  // the row is shown, not counted (answers to step 5): no filter counts it, its table is "same", the import counts nothing
  for (const f of ["all", "new", "changed", "rename", "missing", "rel"]) expect(await filterCount(page, f)).toBe(0);
  await expect(page.locator('[data-testid="review-table"][data-key$="customers"] header')).toContainText("same");
  await expect(page.getByTestId("review-nothing")).toHaveText("The file matches what CRM has, apart from classifications, which stay yours. Importing only records the import and updates row counts.");
  await importNow(page, "Imported into CRM: No changes");
  const last = (await imports((await systemNamed("CRM"))!.id)).at(0)!;
  expect(last).toMatchObject({ source_label: "crm_again.csv", tables_new: 0, columns_new: 0, columns_changed: 0, columns_renamed: 0, columns_missing: 0, relationships_new: 0 });
  expect(await classesOf(fname)).toEqual(before);
});
