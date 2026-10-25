// S7B-11: where changes show (items 20–24): the system panel (open, high first, the resolved history), the table
// panel, the tree's count, the status bar and the canvas row marks; the counts follow an action.

import { expect, test } from "./fixtures";
import { act, column, crmChanges, openSystem, row, treeItem } from "./helpers";

test("S7B-11: the status bar, the tree, the system and table panels and the canvas rows show the open changes", async ({ page }) => {
  await crmChanges();
  await openSystem(page);
  await expect(page.getByTestId("status-source-changes")).toHaveText("Source changes to resolve 9");
  const crm = page.getByTestId("tree-system").filter({ hasText: "CRM" });
  await expect(crm.getByTestId("tree-system-changes")).toHaveText("9");
  await expect(page.getByTestId("tree-system").filter({ hasText: "ERP" }).getByTestId("tree-system-changes")).toHaveCount(0);

  // the system panel: open high first, then the history (customer_addresses came back)
  const panel = page.getByTestId("panel-source-system");
  await expect(panel.getByTestId("section-changes")).toContainText("Changes to resolve (9)");
  await expect(panel.getByTestId("change-card").first()).toHaveAttribute("data-severity", "high");
  await expect(panel.getByTestId("changes-resolved").locator("summary")).toHaveText("1 resolved change");

  // the canvas rows: changed, new, missing (classes on the rows, AD-24)
  const id = async (name: string) => (await column("customers", name)).id;
  await expect(row(page, "customers", await id("cust_no"))).toHaveClass(/\bchg\b/);
  await expect(row(page, "customers", await id("consent_flag"))).toHaveClass(/\bnew\b/);
  await expect(row(page, "customers", await id("segment"))).toHaveClass(/\bgone\b/);
  await expect(row(page, "customers", await id("fname"))).not.toHaveClass(/\b(chg|new|gone|old)\b/);

  // an action moves the counts
  await act(page, "column_left", "dbo.customers.segment", "retire", /^Retired: kept as historical/);
  await expect(page.getByTestId("status-source-changes")).toHaveText("Source changes to resolve 8");
  await expect(crm.getByTestId("tree-system-changes")).toHaveText("8");
  await expect(panel.getByTestId("changes-resolved").locator("summary")).toHaveText("2 resolved changes");

  // the table panel: its open changes, without the history
  await treeItem(page, "customers").click();
  const t = page.getByTestId("panel-source-table");
  await expect(t.getByTestId("section-table-changes")).toContainText("To resolve (6)");
  await expect(t.getByTestId("change-card")).toHaveCount(6);
  await expect(t.getByTestId("changes-resolved")).toHaveCount(0);
});

test("S7B-11: with nothing open the status bar has no source changes and the panel says nothing to resolve", async ({ page }) => {
  await openSystem(page);
  await expect(page.getByTestId("status-source-changes")).toHaveCount(0);
  await expect(page.getByTestId("changes-none")).toHaveText("Nothing to resolve.");
});
