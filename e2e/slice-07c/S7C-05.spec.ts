// S7C-05: remove and restore: the confirmation lists the uses and, for a built-in one, the rules that stop; Cancel
// changes nothing; Remove takes the links with it; Undo brings both back; a removed built-in one restored comes back
// empty.

import { WHAT_STOPS } from "../../src/domain/model/classifications";
import { expect, test } from "./fixtures";
import { classesOf, classification, columnId, expectToast, groups, listRow, loadModel, openColumn, openList, toggle, undo } from "./helpers";

const piiLinks = async () => {
  const m = await loadModel();
  const pii = m.classifications.find((c) => c.code === "PII")!;
  return m.classificationLinks.filter((l) => l.classification_id === pii.id).length;
};

test("S7C-05: remove Personal data: its uses and what stops first, Cancel, Remove with its links, Undo, Restore empty", async ({ page }) => {
  await openColumn(page, "customers", "fname");
  await expect(toggle(page, "Personal data")).toHaveAttribute("aria-pressed", "true");
  await openList(page);
  const dialog = page.getByTestId("dialog-classifications");
  await listRow(page, "Personal data").getByTestId("button-remove-classification").click();
  const form = dialog.getByTestId("form-remove-classification");
  await expect(form.getByTestId("remove-classification-uses")).toHaveText("Personal data is used on 0 tables and 6 columns.");
  await expect(form.getByTestId("classification-use")).toHaveText([
    "dbo.customer_addresses.street_line1",
    "dbo.customers.dob",
    "dbo.customers.email_addr",
    "dbo.customers.fname",
    "dbo.customers.lname",
    "public.web_users.email",
  ]);
  await expect(form.getByTestId("remove-classification-stops")).toHaveText(WHAT_STOPS.PII!);
  await form.getByTestId("button-cancel-remove-classification").click();
  await expect(form).toHaveCount(0);
  expect((await classification("PII")).deleted_at).toBeNull();
  expect(await piiLinks()).toBe(6);

  await listRow(page, "Personal data").getByTestId("button-remove-classification").click();
  await form.getByTestId("button-confirm-remove-classification").click();
  await expectToast(page, "Removed Personal data from the list.");
  await expect.poll(async () => (await classification("PII")).deleted_at).not.toBeNull();
  expect(await classesOf(await columnId("customers", "fname"))).toEqual([]);
  await expect(dialog.getByTestId("removed-classification")).toHaveText(/Personal data/);

  // Undo brings the classification and its links back
  await page.keyboard.press("Escape");
  await expect(toggle(page, "Personal data")).toHaveCount(0);
  await undo(page);
  await expect.poll(async () => (await classification("PII")).deleted_at).toBeNull();
  expect(await piiLinks()).toBe(6);
  await expect(toggle(page, "Personal data")).toHaveAttribute("aria-pressed", "true");

  // removed again and restored: it comes back empty, under the name it had
  await openList(page);
  await listRow(page, "Personal data").getByTestId("button-remove-classification").click();
  await form.getByTestId("button-confirm-remove-classification").click();
  await expectToast(page, "Removed Personal data from the list.");
  await dialog.getByTestId("removed-classification").getByTestId("button-restore-classification").click();
  await expectToast(page, "Restored Personal data.");
  await expect.poll(async () => (await classification("PII")).deleted_at).toBeNull();
  expect(await piiLinks()).toBe(0);
  await page.keyboard.press("Escape");
  await expect(groups(page)).toHaveText(["General"]);
  await expect(toggle(page, "Personal data")).toHaveAttribute("aria-pressed", "false");
});

test("S7C-05: an unused one is removed at once (nothing to show); Business key names what stops", async ({ page }) => {
  await openColumn(page, "customers", "cust_no");
  await openList(page);
  const dialog = page.getByTestId("dialog-classifications");
  await listRow(page, "Load date").getByTestId("button-remove-classification").click();
  await expectToast(page, "Removed Load date from the list.");
  await expect(dialog.getByTestId("removed-classification")).toHaveText(/Load date/);
  await listRow(page, "Business key").getByTestId("button-remove-classification").click();
  await expect(dialog.getByTestId("remove-classification-stops")).toHaveText(WHAT_STOPS.BK!);
  await expect(dialog.getByTestId("remove-classification-uses")).toHaveText("Business key is used on 0 tables and 4 columns.");
});
