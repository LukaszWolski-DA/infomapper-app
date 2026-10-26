// S7B-09: Approve again all {n} (P9, item 17; step 1 answer Q11): the list with the reasons before approving; the
// mappings that don't fit listed apart first and left in review; with four-eyes on, those this person may not approve
// listed apart; one undo step. The entry reads “Review the {n} sent back…” and only the confirm button counts what it
// approves (Łukasz's step 4 answer 2).

import { FOUR_EYES_HEAD, NOT_FIT_HEAD, REVIEW_SENT_BACK } from "../../src/domain/source-changes/texts";
import { expect, test } from "./fixtures";
import { crmChanges, expectToast, loadModel, openSystem, SEED_IDS, setFourEyes, undo } from "./helpers";

const status = async (attribute: string) => {
  const m = await loadModel();
  const a = m.attributes.find((x) => x.name === attribute)!;
  return m.mappings.find((x) => x.attribute_id === a.id && x.status !== "draft")!.status;
};
const entry = (page: import("@playwright/test").Page) => page.getByTestId("import-entry").filter({ hasText: "crm_snapshot_2026-10-20.csv" });

test("S7B-09: approve again all lists the mappings with their reasons, leaves those that don't fit, and undoes in one step", async ({ page }) => {
  await crmChanges();
  await openSystem(page);
  await expect(entry(page).getByTestId("button-approve-all")).toHaveText(REVIEW_SENT_BACK(2));
  await entry(page).getByTestId("button-approve-all").click();
  await expect(entry(page).getByTestId("button-approve-all")).toHaveCount(0);
  const form = entry(page).getByTestId("form-approve-all");
  await expect(form.getByTestId("button-approve-all-confirm")).toHaveText("Approve 1");
  await expect(form.getByTestId("approve-all-entry")).toHaveText(["Customer.customer_number: business key column changed type, varchar(20) → varchar(25)"]);
  await expect(form.getByTestId("approve-all-not-fit")).toContainText(NOT_FIT_HEAD);
  await expect(form.getByTestId("approve-all-not-fit")).toContainText("Customer.email: type conflict, varchar(255) into string(120)");
  await form.getByTestId("button-approve-all-confirm").click();
  await expectToast(page, "Approved again: 1 mapping");
  expect([await status("customer_number"), await status("email")]).toEqual(["approved", "review"]);

  await undo(page);
  await expect.poll(() => status("customer_number")).toBe("review");
});

test("S7B-09: with four-eyes on, the mappings this person may not approve are listed apart and stay in review", async ({ page, browser }) => {
  await setFourEyes(true);
  await crmChanges(SEED_IDS.userLukasz);
  await openSystem(page);
  await entry(page).getByTestId("button-approve-all").click();
  const form = entry(page).getByTestId("form-approve-all");
  await expect(form.getByTestId("approve-all-four-eyes")).toContainText(FOUR_EYES_HEAD);
  await expect(form.getByTestId("approve-all-four-eyes")).toContainText("Customer.customer_number");
  // a mapping both not fitting and the importer's is listed once, under “don't fit”
  await expect(form.getByTestId("approve-all-four-eyes")).not.toContainText("Customer.email");
  await expect(form.getByTestId("button-approve-all-confirm")).toHaveText("Approve 0");
  await expect(form.getByTestId("button-approve-all-confirm")).toBeDisabled();

  const other = await browser.newPage();
  await openSystem(other, "Piotr Wiśniewski");
  await entry(other).getByTestId("button-approve-all").click();
  await entry(other).getByTestId("button-approve-all-confirm").click();
  await expectToast(other, "Approved again: 1 mapping");
  expect(await status("customer_number")).toBe("approved");
  await other.close();
});
