// S7C-08: the comment: read-only "From the source:" in the column panel; a re-import still shows a comment overwrite in
// the review (slice 7a) and leaves the note alone.

import { expect, test } from "./fixtures";
import { columnId, expectToast, importAs, importNow, loadModel, openColumn, reviewFile, reviewRow, sample, SEED_IDS } from "./helpers";

test("S7C-08: the source's comment read-only; a re-import's overwrite shown in the review; the note left alone", async ({ page }) => {
  // the CRM file gives cust_no its comment
  await importAs(SEED_IDS.userLukasz, "CRM", "crm_snapshot_2026-10-20.csv", sample("crm_snapshot_2026-10-20.csv"));
  await openColumn(page, "customers", "cust_no");
  const panel = page.getByTestId("panel-source-column");
  await expect(panel.getByTestId("source-column-comment")).toHaveText("From the source: Customer number shown to the customer");
  await expect(panel.locator("input, textarea").filter({ hasText: "Customer number shown" })).toHaveCount(0);
  await expect(panel.getByTestId("input-source-note")).toHaveValue("");

  const note = panel.getByTestId("input-source-note");
  await note.fill("Our note");
  await note.blur();
  await expectToast(page, "Note saved on cust_no");

  // a file with another comment: the review shows the overwrite; the import writes it; the note stays
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("button-import-sources").click();
  await reviewFile(page, { existing: "CRM" }, "crm.csv", sample("crm_snapshot_2026-10-20.csv").replace("Customer number shown to the customer", "The customer's number"));
  await expect(reviewRow(page, "cust_no")).toContainText("comment: Customer number shown to the customer→The customer's number");
  await importNow(page, /^Imported into CRM: /);
  const custNo = await columnId("customers", "cust_no");
  await expect.poll(async () => (await loadModel()).sourceColumns.find((c) => c.id === custNo)!.comment).toBe("The customer's number");
  expect((await loadModel()).sourceColumns.find((c) => c.id === custNo)!.note_text).toBe("Our note");
});
