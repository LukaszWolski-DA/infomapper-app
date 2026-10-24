import { expect, test } from "./fixtures";
import { giveFile, next, openWizard, sample, target } from "./helpers";

test("S7A-01: the file channel reads the standard (counts, warnings), shows each reading error, and keeps Next until it reads", async ({ page }) => {
  const dialog = await openWizard(page);
  await expect(page.getByTestId("import-title")).toHaveText("Import sources into CRM");
  await expect(page.getByTestId("wizard-note")).toHaveText("Choose a file, or paste a query result.");
  await expect(page.getByTestId("button-wizard-next")).toBeDisabled();

  // an error stops it on step 1 (item 9)
  await giveFile(page, "import-file", "empty.csv", "");
  await expect(page.getByTestId("import-error")).toContainText("The file can’t be read. The file is empty.");
  await expect(page.getByTestId("wizard-note")).toHaveText("Fix the file to continue.");
  await expect(page.getByTestId("button-wizard-next")).toBeDisabled();
  await page.getByTestId("button-choose-another").click();
  await giveFile(page, "import-file", "names.csv", "name,type\na,int");
  await expect(page.getByTestId("import-error")).toContainText(
    "The file has no “database”, “schema”, “table”, “column” columns. Name the columns as in the standard below.",
  );
  await page.getByTestId("button-choose-another").click();
  const big = `database,schema,table,column,data_type\n${Array.from({ length: 30_001 }, (_, i) => `d,s,t${i % 100},c${i},int`).join("\n")}`;
  await giveFile(page, "import-file", "big.csv", big);
  await expect(page.getByTestId("import-error")).toContainText("The file has 30,001 rows; one import takes up to 30,000. Split it by database or schema.");
  await page.getByTestId("button-choose-another").click();

  // the CRM test file: tables, columns and warnings (shown in the review)
  await giveFile(page, "import-file", "crm_snapshot_2026-10-20.csv", sample("crm_snapshot_2026-10-20.csv"));
  await expect(page.getByTestId("import-loaded")).toContainText("crm_snapshot_2026-10-20.csv4 tables, 24 columns, 4 warnings (shown in the review)");
  await expect(page.getByTestId("wizard-note")).toHaveText("Read 4 tables and 24 columns from crm_snapshot_2026-10-20.csv.");
  await next(page);
  await next(page);
  await expect(page.getByTestId("review-warnings")).toContainText("Classification “TECH” on dbo.customers is not read yet: only Business key and PII are read for now.");
  await expect(page.getByTestId("review-warnings")).toContainText("Row 26: stage.customers_load.batch_ref has no data_type. Column skipped.");

  // a type the importer cannot read is kept, with its warning (step 2, decision 3)
  await page.getByTestId("wizard-step-1").click();
  await page.getByTestId("button-choose-another").click();
  await giveFile(page, "import-file", "arrays.csv", "database,schema,table,column,data_type\npg,public,t,tags,text[]");
  await target(page, { new: "Arrays" });
  await next(page);
  await next(page);
  await expect(page.getByTestId("review-warnings")).toContainText(
    "Type “text[]” of public.t.tags is kept as written; the type check cannot judge mappings from this column.",
  );
  await expect(dialog).toBeVisible();
});

test("S7A-01: the standard's description and template.csv with Copy are in the dialog", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openWizard(page);
  await page.getByTestId("details-standard").locator("summary").click();
  await expect(page.getByTestId("details-standard")).toContainText("fk_name, fk_ref_schema, fk_ref_table, fk_ref_column");
  await expect(page.getByTestId("text-template")).toHaveValue(/^database,schema,table,object_type,file_format,row_count/);
  await page.getByTestId("button-copy-template").click();
  await expect(page.getByTestId("button-copy-template")).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("flat_files,ref_data,country_codes,file,xlsx");
});
