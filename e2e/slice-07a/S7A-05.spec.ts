import { updateSourceColumn } from "../../src/domain/commands/source";
import { expect, test } from "./fixtures";
import { asPerson, crmPartial, filterCount, importNow, loadModel, openWizard, reviewFile, reviewRow, sample, SEED_IDS } from "./helpers";

const column = async (table: string, name: string) => {
  const m = await loadModel();
  const t = m.sourceTables.find((x) => x.name === table)!;
  return m.sourceColumns.find((c) => c.source_table_id === t.id && c.name === name)!;
};

test("S7A-05: re-importing CRM: new, changed, unchanged, missing and back, the table's meta, new relationships, with the counts on the filters", async ({ page }) => {
  // first a file without customers.segment and without customer_addresses: both missing from source
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm_partial.tsv", crmPartial());
  await expect(page.getByTestId("review-table").filter({ hasText: "dbo.customer_addresses" })).toHaveAttribute("data-status", "missing");
  await importNow(page, "Imported into CRM: 7 missing from source");
  expect((await column("customers", "segment")).missing_since).not.toBeNull();

  // then the changed CRM file
  await page.getByTestId("button-import-sources").click();
  await reviewFile(page, { existing: "CRM" }, "crm_snapshot_2026-10-20.csv", sample("crm_snapshot_2026-10-20.csv"));
  expect(await filterCount(page, "all")).toBe(25);
  await expect(page.getByTestId("filter-new")).toHaveText("11 new (2 tables)");
  expect(await filterCount(page, "changed")).toBe(9);
  expect(await filterCount(page, "rename")).toBe(2);
  expect(await filterCount(page, "missing")).toBe(1);
  expect(await filterCount(page, "rel")).toBe(2);

  const customers = page.getByTestId("review-table").filter({ hasText: "dbo.customers" }).first();
  await expect(customers).toHaveAttribute("data-status", "changed");
  await expect(customers.getByTestId("review-meta")).toContainText("comment–→Customer master");
  await expect(customers).toContainText("rows 182,340 → 184,120");
  await expect(reviewRow(page, "cust_no")).toHaveAttribute("data-status", "changed");
  await expect(reviewRow(page, "cust_no")).toContainText("type: varchar(20)→varchar(25)");
  await expect(reviewRow(page, "created_ts")).toHaveAttribute("data-status", "missing");
  await expect(reviewRow(page, "created_ts")).toContainText("Was datetime2");
  await expect(reviewRow(page, "consent_flag")).toHaveAttribute("data-status", "new");
  // positions are shown among the unchanged columns, not counted (step 1, answer 11)
  await customers.getByTestId("button-unchanged").click();
  await expect(reviewRow(page, "updated_ts")).toHaveAttribute("data-status", "unchanged");
  await expect(reviewRow(page, "updated_ts")).toContainText("position 9→7");
  // the missing table is back, its columns too, with what changed meanwhile
  const addresses = page.getByTestId("review-table").filter({ hasText: "dbo.customer_addresses" });
  await expect(addresses).toHaveAttribute("data-status", "back");
  await expect(addresses.getByTestId("review-row").filter({ hasText: "city" })).toContainText("Back in the source after being missing since");
  await expect(addresses.getByTestId("review-row").filter({ hasText: "city" })).toContainText("type: nvarchar(60)→nvarchar(80)");
  await page.getByTestId("filter-rel").click();
  await expect(page.getByTestId("review-relationship")).toHaveCount(2);
  await expect(page.getByTestId("review-relationship").first()).toContainText("dbo.customer_addresses.cust_id→dbo.customers.cust_id");

  await importNow(page, "Imported into CRM: 2 new tables, 11 new columns, 8 changed columns, 1 renamed column, 1 missing from source, 2 new relationships");
  expect((await column("customer_addresses", "city")).missing_since).toBeNull();
  expect((await column("customers", "segment")).missing_since).not.toBeNull(); // still missing
});

test("S7A-05: P2: a file without column_comment changes no comment; a comment the file would overwrite is a change (answer 8)", async ({ page }) => {
  const custNo = await column("customers", "cust_no");
  await asPerson(SEED_IDS.userLukasz, (ctx, access) => updateSourceColumn(ctx, access, { column: custNo }, { sourceColumnId: custNo.id, expectedVersion: custNo.version, comment: "Typed by hand" }));
  // the SQL Server result without its column_comment column
  const rows = sample("crm_sqlserver_catalog.tsv").split(/\r?\n/).filter(Boolean).map((l) => l.split("\t"));
  const drop = rows[0]!.indexOf("column_comment");
  const withoutComments = rows.map((r) => r.filter((_, i) => i !== drop).join("\t")).join("\n");
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm_no_comments.tsv", withoutComments);
  await expect(page.getByTestId("review-row").filter({ hasText: "cust_no" })).toHaveCount(0);
  await importNow(page, /^Imported into CRM: /);
  expect((await column("customers", "cust_no")).comment).toBe("Typed by hand");

  // with comments: the file's (empty) comment would overwrite it, shown as a change
  await page.getByTestId("button-import-sources").click();
  await reviewFile(page, { existing: "CRM" }, "crm.tsv", sample("crm_sqlserver_catalog.tsv"));
  await expect(reviewRow(page, "cust_no")).toContainText("comment: Typed by hand→–");
});
