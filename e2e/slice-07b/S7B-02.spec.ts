// S7B-02: the review's two callouts (PRD item 9): the changes the import will raise, and the requirements whose
// coverage changes with before and after and why, both over the whole plan (a filter that hides the rows changes
// neither); a re-import that changes nothing says “No requirement’s coverage changes.”.

import { expect, test } from "./fixtures";
import { crmPartial, importAs, openWizard, reviewFile, sample, SEED_IDS } from "./helpers";

test("S7B-02: the review shows the changes to resolve and the coverage before and after, over the whole plan", async ({ page }) => {
  await importAs(SEED_IDS.userLukasz, "CRM", "crm_partial.tsv", crmPartial());
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm_snapshot_2026-10-20.csv", sample("crm_snapshot_2026-10-20.csv"));

  const changes = page.getByTestId("callout-changes");
  await expect(changes).toHaveAttribute("data-high", "true");
  await expect(changes).toHaveText(/^After the import, 8 changes to resolve, 2 of them high\. They wait on CRM’s page until you decide: /);
  for (const kind of ["new tables", "new columns", "columns that left", "type conflicts", "business key changes"]) await expect(changes).toContainText(kind);

  const coverage = page.getByTestId("callout-coverage");
  await expect(coverage).toContainText("Requirements whose coverage changes");
  const req102 = coverage.getByTestId("coverage-change").filter({ hasText: "REQ-102" });
  await expect(req102).toContainText("Contact data for every active customer");
  await expect(req102).toContainText(/\d+ of \d+ → \d+ of \d+/);
  await expect(req102).toContainText("email: mapping back to review, type conflict");
  const before = { changes: await changes.textContent(), coverage: await coverage.textContent() };

  // over the whole plan: the relationships filter hides every column row, the callouts stay the same
  await page.getByTestId("filter-rel").click();
  await expect(page.getByTestId("review-row")).toHaveCount(0);
  expect(await changes.textContent()).toBe(before.changes);
  expect(await coverage.textContent()).toBe(before.coverage);
});

test("S7B-02: a re-import that changes nothing says no requirement's coverage changes and raises nothing", async ({ page }) => {
  await openWizard(page);
  await reviewFile(page, { existing: "CRM" }, "crm.tsv", sample("crm_sqlserver_catalog.tsv"));
  await expect(page.getByTestId("callout-coverage")).toHaveText("No requirement’s coverage changes.");
  await expect(page.getByTestId("callout-changes")).toHaveCount(0);
});
