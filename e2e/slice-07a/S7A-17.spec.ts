import { expect, test } from "./fixtures";
import { filterCount, giveFile, importNow, next, openWizard, reviewRow, sample, target } from "./helpers";

test("S7A-17: a system imported from a DDL script and re-imported from the catalog query shows only what a script cannot give, and sends no mapping to review", async ({ page }) => {
  await openWizard(page);
  await target(page, { new: "Billing" });
  await page.getByTestId("radio-channel-ddl").check();
  await giveFile(page, "ddl-file", "billing.sql", sample("billing.sql"));
  await next(page);
  await next(page);
  await importNow(page, "Imported into Billing: 2 new tables, 14 new columns, 1 new relationship");

  await page.getByTestId("button-import-sources").click();
  await target(page, { existing: "Billing" });
  await page.getByTestId("radio-channel-query").check();
  await page.getByTestId("input-paste-result").fill(sample("billing_sqlserver_catalog.tsv"));
  await page.getByTestId("button-read-paste").click();
  await next(page);
  await next(page);
  // the computed column's type and the view: what the script did not give
  expect(await filterCount(page, "changed")).toBe(1);
  await expect(reviewRow(page, "full_ref")).toContainText("type: computed→varchar(24)");
  await expect(page.getByTestId("filter-new")).toHaveText("2 new (1 table)");
  await expect(page.getByTestId("review-table").filter({ hasText: "dbo.v_open_invoices" })).toHaveAttribute("data-status", "new");
  expect(await filterCount(page, "missing")).toBe(0);
  expect(await filterCount(page, "rel")).toBe(0);
  await expect(page.getByTestId("callout-send-back")).toHaveCount(0);
});
