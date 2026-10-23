import { expect, test } from "./fixtures";
import { giveFile, next, openWizard, sample } from "./helpers";

test("S7A-02: the query channel shows each database's catalog query with Copy and its how-to; a pasted SSMS result with NULL cells reads; later ones are disabled", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openWizard(page);
  await expect(page.getByTestId("radio-channel-dbt")).toBeDisabled();
  await page.getByTestId("radio-channel-query").check();
  const vendor = page.getByTestId("select-vendor");
  // an <option> is not “disabled” to Playwright's toBeDisabled: its attribute says it
  await expect(vendor.locator("option", { hasText: "Snowflake (later)" })).toHaveAttribute("disabled", "");
  await expect(vendor.locator("option", { hasText: "Databricks (later)" })).toHaveAttribute("disabled", "");
  // SQL Server: fractional seconds as precision (step 3, question 1)
  await expect(page.getByTestId("text-catalog-query")).toHaveValue(/WHEN t\.name IN \('datetime2','datetimeoffset','time'\) THEN c\.scale END AS precision/);
  await expect(page.getByTestId("query-how")).toHaveText(/^Run it in SSMS or DBeaver/);
  await page.getByTestId("button-copy-query").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("FROM sys.objects o");
  await vendor.selectOption("postgres");
  await expect(page.getByTestId("text-catalog-query")).toHaveValue(/WHEN t\.typname IN \('timestamp', 'timestamptz', 'time', 'timetz'\) AND a\.atttypmod >= 0 THEN a\.atttypmod/);
  await expect(page.getByTestId("query-how")).toContainText("copy ( the query without its semicolon )");
  await vendor.selectOption("oracle");
  await expect(page.getByTestId("text-catalog-query")).toHaveValue(/FROM all_tab_columns c/);
  await expect(page.getByTestId("query-how")).toHaveText(/^Put your schemas in the WHERE clause first/);

  // the result pasted as SSMS copies it: tabs and NULL cells
  await page.getByTestId("input-paste-result").fill(sample("crm_sqlserver_catalog.tsv"));
  await page.getByTestId("button-read-paste").click();
  await expect(page.getByTestId("import-loaded")).toContainText("pasted query result2 tables, 15 columns");
  await page.getByTestId("button-choose-another").click();
  // or the saved CSV dropped
  await giveFile(page, "query-file", "web.csv", sample("web_postgres_catalog.csv"));
  await expect(page.getByTestId("import-loaded")).toContainText("web.csv1 table, 4 columns");
  await next(page);
  await expect(page.getByTestId("wizard-step-2")).toHaveAttribute("aria-current", "step");
});
