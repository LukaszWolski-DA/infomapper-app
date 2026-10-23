import { expect, test } from "./fixtures";
import { giveFile, next, openWizard, sample, target } from "./helpers";

test("S7A-03: the DDL channel reads a script: what it found and skipped, the database and schema used, the translated standard with Copy, its warnings in the review", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openWizard(page);
  await target(page, { new: "Billing" });
  await page.getByTestId("radio-channel-ddl").check();
  await expect(page.getByTestId("wizard-note")).toHaveText("Paste or drop a script, then read it.");
  await giveFile(page, "ddl-file", "billing.sql", sample("billing.sql"));
  await expect(page.getByTestId("import-loaded")).toContainText("billing.sql: 2 tables, 14 columns, 3 keys, 2 comments, 2 warnings (shown in the review)");
  await expect(page.getByTestId("ddl-used")).toHaveText(
    "Database billing, schema for unqualified names dbo. Skipped: 2 SET statements, 1 CREATE INDEX, 1 default, 1 other ALTER TABLE statement.",
  );
  await page.getByTestId("details-translated").locator("summary").click();
  await expect(page.getByTestId("text-translated-standard")).toHaveValue(/billing,dbo,invoice_line,table,,,,note,6,nvarchar\(max\)/);
  await page.getByTestId("button-copy-standard").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("billing,dbo,invoice,table");
  await next(page);
  await next(page);
  await expect(page.getByTestId("review-warnings")).toContainText("dbo.invoice.full_ref is a computed column");
  await expect(page.getByTestId("review-warnings")).toContainText("view dbo.v_open_invoices skipped.");
  await expect(page.getByTestId("review-table")).toHaveCount(2);

  // pasted, with the Database and schema fields
  await page.getByTestId("wizard-step-1").click();
  await page.getByTestId("button-choose-another").click();
  await page.getByTestId("input-ddl").fill("CREATE TABLE t (a int);");
  await page.getByTestId("input-ddl-database").fill("warehouse");
  await page.getByTestId("input-ddl-schema").fill("ref");
  await page.getByTestId("button-read-ddl").click();
  await expect(page.getByTestId("import-loaded")).toContainText("pasted script: 1 table, 1 column, 0 keys, 0 comments");
  await expect(page.getByTestId("ddl-used")).toHaveText("Database warehouse, schema for unqualified names ref.");
});
