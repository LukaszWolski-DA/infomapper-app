import { changeOf, column, crmChanges } from "../slice-07b/helpers";
import { expect, test } from "./fixtures";
import { holdUntil, notSaved, openTable, recordToasts, STALE, toasts, treeItem } from "./helpers";

// S14B-08 (item 7, O4): while a change-to-resolve action is on its way, a panel save of a row it names waits for its
// answer and is sent with the version it brings: no conflict, no "Not saved". Without the hold the note's save would
// send the column's version from before the action and be refused. (Step 3 measured the whole-source hold over its bar;
// the hold is the change's table, `held.ts`.)
//
// A save of another source's column is not held by the chain (`held.test.ts`: another table's rows are not in the hold),
// but the browser cannot show it here: Next.js sends a page's server actions one at a time, so while the action's answer
// is held no other action leaves (step 3). The test checks that such a save, typed in the same time, is stored after it
// without a refusal.

const NOTE_CRM = "Kept for the loyalty project";
const NOTE_ERP = "The ERP reference of the customer";

test("S14B-08: a column's note typed while Not needed is on its way is stored after it, with no conflict; another source's note too", async ({ page }) => {
  await crmChanges();
  const change = await changeOf("new_column", "customer_segment");
  await recordToasts(page);
  await openTable(page, "customers", "customer_segment");
  const tablePanel = page.getByTestId("panel-source-table");
  const hold = await holdUntil(page, change.id);
  await tablePanel.getByTestId("change-card").filter({ hasText: "dbo.customers.customer_segment" }).getByTestId("change-action-not_needed").click();
  await expect.poll(() => hold.held()).toBe(true);

  // the column the action writes: its note waits for the action's answer
  await tablePanel.getByTestId("list-table-columns").getByRole("button", { name: /^customer_segment/ }).click();
  const crmNote = page.getByTestId("panel-source-column").getByTestId("input-source-note");
  await crmNote.fill(NOTE_CRM);
  await crmNote.press("Tab");
  await page.waitForTimeout(700);
  expect((await column("customers", "customer_segment")).note_text ?? null).toBeNull();

  // another source's column (ERP) in the same time
  await page.getByTestId("tab-sources").click();
  await treeItem(page, "order_header").click();
  await page.getByTestId("panel-source-table").getByTestId("list-table-columns").getByRole("button", { name: /^cust_ref/ }).click();
  const erpNote = page.getByTestId("panel-source-column").getByTestId("input-source-note");
  await erpNote.fill(NOTE_ERP);
  await erpNote.press("Tab");

  hold.release();
  await hold.given;
  await expect.poll(async () => (await column("customers", "customer_segment")).note_text).toBe(NOTE_CRM);
  await expect.poll(async () => (await column("order_header", "cust_ref")).note_text).toBe(NOTE_ERP);
  expect((await column("customers", "customer_segment")).not_needed).toBe(true);
  expect(await toasts(page)).not.toContain(STALE);
  await expect(notSaved(page)).toHaveCount(0);
});
