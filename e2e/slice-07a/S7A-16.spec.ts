// S7A-16 (step 1, answer 5): re-importing an unchanged SQL Server, PostgreSQL and Oracle catalog result shows no changes
// and sends no mapping to review. Through the query channel with each database chosen, as such a result arrives: the
// demo's CRM (SQL Server) and WEB (PostgreSQL) against the seed, and HR read from Oracle once and then again.

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { filterCount, giveFile, importNow, loadModel, next, openWizard, sample, target } from "./helpers";

async function queryReview(page: Page, system: { existing: string } | { new: string }, vendor: "sqlserver" | "postgres" | "oracle", file: string) {
  await target(page, system);
  await page.getByTestId("radio-channel-query").check();
  await page.getByTestId("select-vendor").selectOption(vendor);
  await giveFile(page, "query-file", file, sample(file));
  await expect(page.getByTestId("import-loaded")).toBeVisible();
  await next(page);
  await next(page);
  await expect(page.getByTestId("wizard-step-3")).toHaveAttribute("aria-current", "step");
}

async function expectNothing(page: Page, system: string) {
  await expect(page.getByTestId("review-nothing")).toHaveText(`The file matches what ${system} has. Importing only records the import and updates row counts.`);
  expect(await filterCount(page, "all")).toBe(0);
  await expect(page.getByTestId("callout-send-back")).toHaveCount(0);
  await importNow(page, `Imported into ${system}: No changes`);
}

test("S7A-16: unchanged catalog results from SQL Server, PostgreSQL and Oracle show no changes and send no mapping to review", async ({ page }) => {
  const statuses = async () => (await loadModel()).mappings.map((m) => `${m.id}:${m.status}:${m.review_reason}`).sort();
  const before = await statuses();

  await openWizard(page);
  await queryReview(page, { existing: "CRM" }, "sqlserver", "crm_sqlserver_catalog.tsv");
  await expectNothing(page, "CRM");

  await page.getByTestId("button-import-sources").click();
  await queryReview(page, { existing: "WEB" }, "postgres", "web_postgres_catalog.csv");
  await expectNothing(page, "WEB");
  expect(await statuses()).toEqual(before);

  // Oracle: a system read from its catalog result, then the same result again
  await page.getByTestId("button-import-sources").click();
  await queryReview(page, { new: "HR" }, "oracle", "hr_oracle_catalog.csv");
  await importNow(page, /^Imported into HR: \d+ new tables?, /);
  await page.getByTestId("button-import-sources").click();
  await queryReview(page, { existing: "HR" }, "oracle", "hr_oracle_catalog.csv");
  await expectNothing(page, "HR");
});
