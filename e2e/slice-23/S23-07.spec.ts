// S23-07 (slice 23, item 8, F8): slice 7c's dialog is gone. "Edit the list…" in a column's and a table's panel opens the
// workspace home on the Metadata conventions tab, a page of its own (Back returns to the canvas); nothing on the canvas
// opens a dialog of the list.

import { expect, test } from "./fixtures";
import { openColumn, openTable, RETAIL } from "./helpers";

test("S23-07: Edit the list… in a column's panel opens the tab; Back returns to the canvas", async ({ page }) => {
  await openColumn(page, "customers", "cust_no");
  const link = page.getByTestId("panel-source-column").getByTestId("button-edit-classifications");
  await expect(link).toHaveText("Edit the list…");
  await expect(link).toHaveAttribute("href", `/w/${RETAIL}?tab=conventions`);
  const canvas = page.url().split("?")[0];
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/w/${RETAIL}\\?tab=conventions$`));
  await expect(page.getByTestId("page-conventions")).toBeVisible();
  await expect(page.getByTestId("tab-conventions")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("dialog-classifications")).toHaveCount(0);
  await page.goBack();
  await expect.poll(() => page.url().split("?")[0]).toBe(canvas);
  await expect(page.getByTestId("page-conventions")).toHaveCount(0);
});

test("S23-07: Edit the list… in a table's panel opens the tab", async ({ page }) => {
  await openTable(page, "customers", "cust_no");
  const link = page.getByTestId("panel-source-table").getByTestId("button-edit-classifications");
  await expect(link).toHaveAttribute("href", `/w/${RETAIL}?tab=conventions`);
  await link.click();
  await expect(page.getByTestId("page-conventions")).toBeVisible();
  await expect(page.getByTestId("dialog-classifications")).toHaveCount(0);
});
