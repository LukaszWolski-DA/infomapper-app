// S7B-04: retire (P6, item 11; step 1 answer Q10): a column that left with a mapping, and a table. The grey marks on
// the canvas row and the line's segment (classes on the existing elements, AD-24), the tree, the table and column
// panels, and “until {date}” on the mapping's input. That a retired input covers nothing is the D-31 rule through
// `missing_since`, unit-tested in `src/domain/source-changes/actions.test.ts` and the requirement index's tests.

import { expect, test } from "./fixtures";
import { act, column, crmChanges, crmPartial, importAs, loadModel, mappingLine, openSystem, row, SEED_IDS, table, treeItem } from "./helpers";

test("S7B-04: retiring a column keeps it and its mapping as historical, marked grey everywhere", async ({ page }) => {
  await crmChanges();
  const createdTs = await column("customers", "created_ts");
  const mappingId = (await loadModel()).mappingInputs.find((i) => i.source_column_id === createdTs.id)!.mapping_id;
  const since = createdTs.missing_since!.slice(0, 10);

  await openSystem(page);
  await act(page, "column_left", "dbo.customers.created_ts", "retire", "Retired: kept as historical: dbo.customers.created_ts");
  expect((await column("customers", "created_ts")).retired_since).not.toBeNull();
  expect((await loadModel()).mappings.some((m) => m.id === mappingId)).toBe(true);

  // the canvas: the row and its line's segment
  await expect(row(page, "customers", createdTs.id)).toHaveClass(/\bold\b/);
  await expect(row(page, "customers", createdTs.id)).toHaveAttribute("title", "Retired: historical");
  await expect(mappingLine(page, mappingId).locator("path.s.gone title")).toHaveText("Retired: historical");

  // the table panel's columns list, the column panel, the mapping panel
  await treeItem(page, "customers").click();
  const retired = page.getByTestId("panel-source-table").getByTestId("column-retired");
  await expect(retired).toContainText("created_ts");
  await expect(retired).toContainText("retired");
  await retired.click();
  await expect(page.getByTestId("tag-retired")).toHaveText(`Retired: historical since ${since}`);
  await page.getByTestId("panel-source-column").getByRole("button", { name: /Customer\.created_at/ }).click();
  await expect(page.getByTestId("panel-mapping").getByTestId("input-until")).toHaveText(`until ${since}`);
});

test("S7B-04: retiring a table retires it and its missing columns; the tree strikes it through in grey", async ({ page }) => {
  await importAs(SEED_IDS.userLukasz, "CRM", "crm_partial.tsv", crmPartial());
  await openSystem(page);
  await act(page, "table_left", "dbo.customer_addresses", "retire", "Retired: kept as historical: dbo.customer_addresses");
  const t = await table("customer_addresses");
  expect(t.retired_since).not.toBeNull();
  expect((await loadModel()).sourceColumns.filter((c) => c.source_table_id === t.id).every((c) => c.retired_since)).toBe(true);

  const item = treeItem(page, "customer_addresses");
  await expect(item).toHaveAttribute("data-missing", "retired");
  await expect(item).toHaveAttribute("title", /^Retired, historical\. /);
  await expect(item.getByTestId("dot-missing")).toHaveCount(0);
  await item.click();
  await expect(page.getByTestId("panel-source-table").getByTestId("tag-retired")).toHaveText(`Retired: historical since ${t.missing_since!.slice(0, 10)}`);
});
