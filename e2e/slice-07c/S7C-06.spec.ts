// S7C-06: rules follow the code. With Business key removed: no business key suggestion on attributes, no send-back or
// change for a business key column's type change, no business key suggestion in the import, no BK badge; restored and
// set again, each works again. (Unit tests per rule: mapping-rules, import/classifications, settle, canvas.)

import { restoreClassification } from "../../src/domain/commands/classification";
import { expect, test } from "./fixtures";
import { asLukasz, canvasUrl, classify, columnId, fileOf, loadModel, removeBuiltin, reviewFile, sample, signInAs } from "./helpers";
import { openCanvas } from "../slice-01a/helpers";

const customerNumber = async () => (await loadModel()).attributes.find((a) => a.name === "customer_number")!.id;
const SINGLE_KEY = fileOf([["t", "id", "int", { pk: true }], ["t", "name", "varchar(20)"]]);

async function rulesWork(page: import("@playwright/test").Page, on: boolean) {
  // the attribute's suggestion (AD-28): customer_number is fed by cust_no
  await signInAs(page, "Łukasz");
  await openCanvas(page, `${canvasUrl()}?row=${await customerNumber()}`);
  await expect(page.getByTestId("panel-attribute")).toBeVisible();
  await expect(page.getByTestId("note-bk-suggestion")).toHaveCount(on ? 1 : 0);
  // the BK badge on the customers card's cust_no
  await expect(page.locator(`[data-row="${await columnId("customers", "cust_no")}"] .tag.bk`)).toHaveCount(on ? 1 : 0);
  // a re-import that widens cust_no: the send-back and the change (D-51, D-56)
  await page.getByTestId("tab-sources").click();
  await page.getByTestId("button-import-sources").click();
  await reviewFile(page, { existing: "CRM" }, "crm_snapshot_2026-10-20.csv", sample("crm_snapshot_2026-10-20.csv"));
  if (on) {
    await expect(page.getByTestId("callout-send-back")).toContainText("Customer.customer_number: business key column changed type, varchar(20) → varchar(25)");
    await expect(page.getByTestId("callout-changes")).toContainText("business key changes");
  } else {
    await expect(page.getByTestId("callout-send-back")).not.toContainText("business key");
    await expect(page.getByTestId("callout-changes")).not.toContainText("business key");
  }
  await page.keyboard.press("Escape");
  // the import's suggestion for a new system
  await page.getByTestId("button-import-sources").click();
  await reviewFile(page, { new: "Sales feed" }, "feed.csv", SINGLE_KEY);
  await expect(page.getByTestId("review-suggestion")).toHaveCount(on ? 1 : 0);
}

test("S7C-06: with Business key removed none of its rules acts", async ({ page }) => {
  await removeBuiltin("BK");
  await rulesWork(page, false);
});

test("S7C-06: restored and set again, each rule acts again", async ({ page }) => {
  await removeBuiltin("BK");
  await asLukasz((m) => (ctx, access) => {
    const bk = m.classifications.find((c) => c.code === "BK")!;
    return restoreClassification(ctx, access, m, { classificationId: bk.id, expectedVersion: bk.version });
  });
  await classify("BK", { kind: "source_column", id: await columnId("customers", "cust_no") });
  await rulesWork(page, true);
});

test("S7C-06: before any change the rules act (the seed's Business key)", async ({ page }) => {
  await rulesWork(page, true);
});
