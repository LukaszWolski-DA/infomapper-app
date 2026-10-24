// S7A-10: where the statuses show (PRD items 33–37). CRM imported from its catalog result without customers.email_addr
// (mapped to Customer.email, on “Customer & orders”), customers.segment and customer_addresses: the tree's marks and
// tooltips, the canvas row and line marks (classes on the existing elements, AD-24), the table and column panels; the
// full result again brings everything back and every mark goes. A mapping sent back to review shows its reason.

import { seedId } from "../../src/data/local/seed-model";
import { mappingLine, row, treeItem } from "../slice-01a/helpers";
import { expect, test } from "./fixtures";
import { importNow, loadModel, openWizard, RETAIL, reviewFile, sample } from "./helpers";

const EMAIL = seedId(RETAIL, "column:customers.email_addr");
const EMAIL_MAPPING = seedId(RETAIL, "mapping:customers.email_addr>customer.email");
const without = (...names: string[]) =>
  sample("crm_sqlserver_catalog.tsv")
    .split(/\r?\n/)
    .filter((line) => !names.some((n) => line.includes(`\t${n}\t`)))
    .join("\r\n");

test("S7A-10: the tree, the canvas and the panels mark what is missing from source; a column that comes back loses its marks", async ({ page }) => {
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm_partial.tsv", without("email_addr", "segment", "customer_addresses"));
  await importNow(page, /^Imported into CRM: .*8 missing from source/);
  const since = (await loadModel()).sourceColumns.find((c) => c.id === EMAIL)!.missing_since!.slice(0, 10);

  // the tree (item 33): a missing table struck through with the dot, a table with missing columns with the dot
  const addresses = treeItem(page, "customer_addresses");
  await expect(addresses).toHaveAttribute("data-missing", "table");
  await expect(addresses).toHaveAttribute("title", /^Missing from source\. /);
  await expect(addresses.getByTestId("dot-missing")).toBeVisible();
  const customers = treeItem(page, "customers");
  await expect(customers).toHaveAttribute("data-missing", "columns");
  await expect(customers).toHaveAttribute("title", "Some columns are missing from source. On this canvas. Click to show it.");
  await expect(customers).toContainText("9 cols");
  await expect(treeItem(page, "web_users")).not.toHaveAttribute("data-missing", /./);

  // the canvas (item 34): the row and its mapping line, by classes on the elements that are there anyway
  await expect(row(page, "customers", EMAIL)).toHaveClass(/\bgone\b/);
  await expect(row(page, "customers", EMAIL)).toHaveAttribute("title", "Missing from source");
  await expect(mappingLine(page, EMAIL_MAPPING).locator("path.s")).toHaveClass(/\bgone\b/);
  await expect(page.locator(".row.gone")).toHaveCount(2); // email_addr and segment
  await expect(page.locator("path.s.gone")).toHaveCount(1);

  // the table panel (item 35)
  await customers.click();
  const table = page.getByTestId("panel-source-table");
  await expect(table.getByTestId("source-table-kind")).toHaveText("Source table of CRM");
  await expect(table.getByTestId("source-table-path")).toHaveText("crmprod.dbo");
  await expect(table.getByTestId("source-table-facts")).toHaveText("182,340 rows");
  await expect(table.getByTestId("tag-missing")).toHaveCount(0);
  const columns = table.getByTestId("list-table-columns").locator("button");
  await expect(columns.last()).toContainText("segment");
  await expect(columns.last()).toContainText("missing");
  await expect(columns.nth(-2)).toContainText("email_addr");
  await expect(table.getByTestId("column-missing")).toHaveCount(2);
  await expect(table.getByTestId("table-relationship")).toHaveText("dbo.customer_addresses.cust_id → hereFK_customer_addresses_customers · missing");

  // the missing table's panel, through the relationship (it has no card here): its tag and the relationship's other end
  await table.getByTestId("table-relationship").click();
  await expect(table.locator("h2")).toHaveText("customer_addresses");
  await expect(table.getByTestId("tag-missing")).toHaveText(`Missing from source since ${since}`);
  await expect(table.getByTestId("table-relationship")).toHaveText("cust_id → dbo.customersFK_customer_addresses_customers · missing");

  // the column panel (item 36)
  await row(page, "customers", EMAIL).click();
  await expect(page.getByTestId("panel-source-column").getByTestId("tag-missing")).toHaveText(`Missing from source since ${since}`);

  // the full result: everything is back and loses its marks
  await page.getByTestId("button-import-sources").click();
  await reviewFile(page, { existing: "CRM" }, "crm.tsv", sample("crm_sqlserver_catalog.tsv"));
  await importNow(page, /^Imported into CRM: /);
  await expect(page.locator(".row.gone")).toHaveCount(0);
  await expect(page.locator("path.s.gone")).toHaveCount(0);
  await expect(page.getByTestId("tree-item").and(page.locator("[data-missing]"))).toHaveCount(0);
  await row(page, "customers", EMAIL).click();
  await expect(page.getByTestId("panel-source-column")).toBeVisible();
  await expect(page.getByTestId("tag-missing")).toHaveCount(0);
});

test("S7A-10: a mapping an import sent back to review shows the reason under its status (item 37)", async ({ page }) => {
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm.csv", sample("crm_snapshot_2026-10-20.csv"));
  await importNow(page, /^Imported into CRM: /);
  await row(page, "customers", seedId(RETAIL, "column:customers.cust_no")).click();
  await page.getByTestId("panel-source-column").getByRole("button", { name: /Customer\.customer_number/ }).click();
  await expect(page.getByTestId("note-review-reason")).toHaveText("An import sent it back to review: business key column changed type, varchar(20) → varchar(25).");
  // a mapping in review without a reason (the seed's dob → birth_date, renamed by the import) shows none
  await row(page, "customers", seedId(RETAIL, "column:customers.dob")).click();
  await page.getByTestId("panel-source-column").getByRole("button", { name: /Customer\.birth_date/ }).click();
  await expect(page.getByTestId("panel-mapping")).toBeVisible();
  await expect(page.getByTestId("note-review-reason")).toHaveCount(0);
});
