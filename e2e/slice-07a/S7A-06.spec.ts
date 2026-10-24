import { expect, test } from "./fixtures";
import { giveFile, importNow, loadModel, next, openWizard, sample, target } from "./helpers";

const lines = (text: string, keep: (line: string) => boolean) => {
  const [head, ...rest] = text.split(/\r?\n/);
  return [head, ...rest.filter((l) => l && keep(l))].join("\n");
};
const cityType = async () => {
  const m = await loadModel();
  const t = m.sourceTables.find((x) => x.name === "customer_addresses")!;
  return m.sourceColumns.find((c) => c.source_table_id === t.id && c.name === "city")!;
};

test("S7A-06: an unselected table is untouched; its group shows half selected", async ({ page }) => {
  await openWizard(page);
  await target(page, { existing: "CRM" });
  await giveFile(page, "import-file", "crm.csv", sample("crm_snapshot_2026-10-20.csv"));
  await next(page);
  await page.locator('[data-testid="checkbox-scope-table"][data-key="crmprod|dbo|customer_addresses"]').uncheck();
  expect(await page.locator('[data-testid="checkbox-scope-group"][data-key="crmprod.dbo"]').evaluate((el) => (el as HTMLInputElement).indeterminate)).toBe(true);
  await expect(page.getByTestId("wizard-note")).toHaveText("3 tables of 4 selected.");
  await next(page);
  await expect(page.getByTestId("review-table").filter({ hasText: "customer_addresses" })).toHaveCount(0);
  await importNow(page, /^Imported into CRM: /);
  expect(await cityType()).toMatchObject({ type_length: 60, missing_since: null });
});

test("S7A-06: “Only columns of the tables in the file” marks no other table missing; the mass warning switches to it", async ({ page }) => {
  await openWizard(page);
  await target(page, { existing: "CRM" });
  // only customer_addresses: comparing the schema would mark customers' 9 columns of 15 missing
  await giveFile(page, "import-file", "addresses.csv", lines(sample("crm_sqlserver_catalog.tsv"), (l) => l.includes("\tcustomer_addresses\t")));
  await next(page);
  await expect(page.getByTestId("callout-missing")).toContainText("Not in the file: dbo.customers. It will be marked missing from source, with its mappings kept.");
  await expect(page.getByTestId("callout-mass")).toContainText("This import would mark 9 of 15 columns of CRM missing from source.");
  await page.getByTestId("button-narrow").click();
  await expect(page.getByTestId("radio-compare-tables")).toBeChecked();
  await expect(page.getByTestId("callout-mass")).toHaveCount(0);
  await expect(page.getByTestId("callout-missing")).toHaveCount(0);
  await next(page);
  await expect(page.getByTestId("review-table").filter({ hasText: "dbo.customers" })).toHaveCount(0);
  await importNow(page, /^Imported into CRM: /);
  const m = await loadModel();
  expect(m.sourceColumns.filter((c) => c.missing_since !== null)).toEqual([]);
});
