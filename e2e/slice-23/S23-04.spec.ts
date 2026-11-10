// S23-04 (slice 23, item 7, F6, F7, D-57): removing a used built-in one shows its uses and what stops in a small dialog
// (read when it opens), takes its links, one undo step; it is listed as removed with Restore under its table; Restore is
// refused while its name is taken ("Rename {other} first: {name} is taken."), then restores it unused.

import { WHAT_STOPS } from "../../src/domain/model/classifications";
import { expect, test } from "./fixtures";
import { addOwn, classesOf, columnId, expectToast, loadModel, nameInput, openConventions, rowNamed, rowOf, stored, typeAndLeave, undoButton } from "./helpers";

const bkLinks = async () => {
  const m = await loadModel();
  const bk = m.classifications.find((c) => c.code === "BK")!;
  return m.classificationLinks.filter((l) => l.classification_id === bk.id && l.deleted_at === null).length;
};

test("S23-04: remove Business key with its uses and what stops, Undo, remove again, Restore refused while taken, then restored unused", async ({ page }) => {
  await openConventions(page);
  expect(await bkLinks()).toBe(4);

  await rowOf(page, "BK").getByTestId("button-remove-classification").click();
  const dialog = page.getByTestId("dialog-remove-classification");
  await expect(dialog.getByRole("heading")).toHaveText("Remove Business key?");
  await expect(dialog.getByTestId("remove-classification-uses")).toHaveText("Business key is used on 0 tables and 4 columns.");
  await expect(dialog.getByTestId("classification-use")).toHaveCount(4);
  await expect(dialog.getByTestId("remove-classification-stops")).toHaveText(WHAT_STOPS.BK!);
  // Cancel changes nothing
  await dialog.getByTestId("button-cancel-remove-classification").click();
  await expect(dialog).toHaveCount(0);
  expect((await stored({ code: "BK" }))!.deleted_at).toBeNull();

  await rowOf(page, "BK").getByTestId("button-remove-classification").click();
  await dialog.getByTestId("button-confirm-remove-classification").click();
  await expectToast(page, "Removed Business key from the list.");
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await stored({ code: "BK" }))!.deleted_at).not.toBeNull();
  expect(await bkLinks()).toBe(0);
  expect(await classesOf(await columnId("customers", "cust_no"))).toEqual([]);
  const removed = page.getByTestId("section-column-classifications").getByTestId("section-removed-classifications");
  await expect(removed).toContainText("Removed built-in:");
  await expect(removed.getByTestId("removed-classification")).toHaveText(/^Business key\s*BK\s*Restore$/);
  await expect(rowOf(page, "BK")).toHaveCount(0);

  // one undo step: the classification and its links back
  await undoButton(page).click();
  await expectToast(page, "Undone: Remove classification Business key");
  await expect.poll(async () => (await stored({ code: "BK" }))!.deleted_at).toBeNull();
  expect(await bkLinks()).toBe(4);
  await expect(rowOf(page, "BK").getByTestId("classification-uses")).toHaveText("used 4×");

  // removed again; its name taken by an own one: Restore refused with the app's text (F6)
  await rowOf(page, "BK").getByTestId("button-remove-classification").click();
  await dialog.getByTestId("button-confirm-remove-classification").click();
  await expectToast(page, "Removed Business key from the list.");
  await addOwn(page, "column", "Business key", "");
  await expect(rowNamed(page, "Business key")).toBeVisible();
  await removed.getByTestId("button-restore-classification").click();
  await expectToast(page, "Rename Business key first: Business key is taken.");
  expect((await stored({ code: "BK" }))!.deleted_at).not.toBeNull();

  // the other renamed: restored, unused
  await typeAndLeave(nameInput(rowNamed(page, "Business key")), "Business key (ours)");
  await expect.poll(async () => (await stored({ name: "Business key (ours)" }))?.origin).toBe("own");
  await removed.getByTestId("button-restore-classification").click();
  await expectToast(page, "Restored Business key.");
  await expect.poll(async () => (await stored({ code: "BK" }))!.deleted_at).toBeNull();
  expect(await bkLinks()).toBe(0);
  await expect(rowOf(page, "BK").getByTestId("classification-uses")).toHaveText("unused");
  await expect(page.getByTestId("section-removed-classifications")).toHaveCount(0);
});

test("S23-04: an unused one no rule reads goes at once, with Undo", async ({ page }) => {
  await openConventions(page);
  await rowOf(page, "T_STG").getByTestId("button-remove-classification").click();
  await expectToast(page, "Removed Staging from the list.");
  await expect(page.getByTestId("dialog-remove-classification")).toHaveCount(0);
  await expect(page.getByTestId("section-table-classifications").getByTestId("removed-classification")).toHaveText(/Staging\s*T_STG/);
});
