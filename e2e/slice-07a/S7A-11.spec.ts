// S7A-11: the system panel (PRD item 38) and the system as a history place (item 39). It opens from the Sources tab's
// open button and from a table panel; it shows the counts, “Re-import {system}…” and the imports newest first; after an
// import the Sources tab shows with the system selected and its panel open (item 28); Back and Forward walk to it; a
// system that no longer exists (its import undone) shows its toast.

import { backButton, clickCard, expectSelected, forwardButton } from "../slice-06b/helpers";
import { expect, test } from "./fixtures";
import { crmPartial, expectToast, importNow, openWizard, reviewFile, sample } from "./helpers";

const openSystem = async (page: import("@playwright/test").Page, name: string) => {
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("tree-system").filter({ has: page.getByTestId("tree-system-head").getByText(name, { exact: true }) }).getByTestId("button-open-system").click();
};

test("S7A-11: the system panel opens from the tree and from a table panel, with its counts and no imports yet", async ({ page }) => {
  await openWizard(page);
  await page.keyboard.press("Escape");
  await openSystem(page, "CRM");
  const panel = page.getByTestId("panel-source-system");
  await expect(panel).toContainText("Source system");
  await expect(panel.locator("h2")).toHaveText("CRM");
  await expect(panel.getByTestId("system-counts")).toHaveText("2 tables, 15 columns, 7 mapped");
  await expect(panel).toContainText("No imports yet.");
  await expect(panel.getByTestId("button-reimport")).toHaveText("Re-import CRM…");

  await clickCard(page, "customers");
  await expectSelected(page, "table");
  await page.getByTestId("button-table-system").click();
  await expectSelected(page, "system:CRM");
});

test("S7A-11: Re-import from the system panel; after it the Sources tab, the system's panel and its imports newest first", async ({ page }) => {
  await openWizard(page);
  await page.keyboard.press("Escape");
  await openSystem(page, "CRM");
  // the left panel on another tab: the import brings the Sources tab back
  await page.getByTestId("tab-model").click();
  await page.getByTestId("button-reimport").click();
  await expect(page.getByTestId("import-title")).toHaveText("Import sources into CRM");
  await reviewFile(page, { existing: "CRM" }, "crm_partial.tsv", crmPartial());
  await importNow(page, /^Imported into CRM: /);
  await expect(page.getByTestId("tab-sources")).toHaveAttribute("aria-selected", "true");
  await expectSelected(page, "system:CRM");
  const panel = page.getByTestId("panel-source-system");
  await expect(panel.getByTestId("system-counts")).toHaveText("2 tables, 15 columns, 7 mapped, 7 missing from source");
  await expect(panel.getByTestId("import-entry")).toHaveCount(1);
  await expect(panel.getByTestId("import-entry")).toContainText(/crm_partial\.tsv · Łukasz/);
  await expect(panel.getByTestId("import-entry")).toContainText("7 missing from source");

  await panel.getByTestId("button-reimport").click();
  await reviewFile(page, { existing: "CRM" }, "crm.tsv", sample("crm_sqlserver_catalog.tsv"));
  await importNow(page, /^Imported into CRM: /);
  await expect(panel.getByTestId("import-entry")).toHaveCount(2);
  await expect(panel.getByTestId("import-entry").first()).toContainText("crm.tsv");
  await expect(panel.getByTestId("import-entry").last()).toContainText("crm_partial.tsv");
  await expect(panel.getByTestId("system-counts")).toHaveText("2 tables, 15 columns, 7 mapped");
});

test("S7A-11: the system is a back-and-forward place; a system whose import was undone shows its toast", async ({ page }) => {
  // a new system: after its import, its panel is open and it is a place
  await openWizard(page);
  await reviewFile(page, { new: "HR" }, "hr_snapshot_2026-10-20.csv", sample("hr_snapshot_2026-10-20.csv"));
  await importNow(page, /^Imported into HR: /);
  await expectSelected(page, "system:HR");
  await openSystem(page, "CRM");
  await expectSelected(page, "system:CRM");
  await clickCard(page, "Customer");
  await expectSelected(page, "entity:Customer");

  await backButton(page).click();
  await expectSelected(page, "system:CRM");
  await backButton(page).click();
  await expectSelected(page, "system:HR");
  await forwardButton(page).click();
  await expectSelected(page, "system:CRM");

  // undo HR's import: the system is gone, and Back onto its place says so
  await page.getByTestId("button-undo").click();
  await expectToast(page, /^Undone: Import hr_snapshot_2026-10-20\.csv/);
  await expect(page.getByTestId("tree-system-head").getByText("HR", { exact: true })).toHaveCount(0);
  await backButton(page).click();
  await expectToast(page, "That source system no longer exists.");
  await expectSelected(page, "none");
});
