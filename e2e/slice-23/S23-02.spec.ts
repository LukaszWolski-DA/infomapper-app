// S23-02 (slice 23, items 4, 5, D-57, D-66): Business key renamed and its definition changed, each one undo step, undone
// and redone; the column panel's toggle shows the new name; an empty and an unchanged name write nothing; a taken name
// (another's name, a built-in code such as "pii", ignoring case and _) is refused with its text.

import { expect, test } from "./fixtures";
import { definitionInput, expectToast, nameInput, openColumn, openConventions, redoButton, rowOf, stored, toggle, typeAndLeave, undoButton } from "./helpers";

test("S23-02: rename and define Business key, each one undo step; the panel's toggle shows the new name", async ({ page }) => {
  await openConventions(page, "Anna Nowak");
  const bk = rowOf(page, "BK");

  // the rename: one undo step, undone and redone
  await typeAndLeave(nameInput(bk), "  Natural key  ");
  await expect.poll(async () => (await stored({ code: "BK" }))?.name).toBe("Natural key");
  await expect(nameInput(bk)).toHaveValue("Natural key");
  await undoButton(page).click();
  await expectToast(page, "Undone: Rename classification Business key");
  await expect.poll(async () => (await stored({ code: "BK" }))?.name).toBe("Business key");
  await expect(nameInput(bk)).toHaveValue("Business key");
  await redoButton(page).click();
  await expect.poll(async () => (await stored({ code: "BK" }))?.name).toBe("Natural key");
  await expect(nameInput(bk)).toHaveValue("Natural key");

  // the definition: trimmed, its toast, one undo step, undone and redone
  const before = (await stored({ code: "BK" }))!.definition;
  await typeAndLeave(definitionInput(bk), "  The key the business uses.  ");
  await expectToast(page, "Saved the definition of Natural key.");
  await expect.poll(async () => (await stored({ code: "BK" }))?.definition).toBe("The key the business uses.");
  await undoButton(page).click();
  await expectToast(page, "Undone: Change definition of Natural key");
  await expect.poll(async () => (await stored({ code: "BK" }))?.definition).toBe(before);
  await expect(definitionInput(bk)).toHaveValue(before!);
  await redoButton(page).click();
  await expect.poll(async () => (await stored({ code: "BK" }))?.definition).toBe("The key the business uses.");
  // emptied: cleared
  await typeAndLeave(definitionInput(bk), "   ");
  await expectToast(page, "Cleared the definition of Natural key.");
  await expect.poll(async () => (await stored({ code: "BK" }))?.definition).toBeNull();

  // the column panel's toggle has the new name (the code keeps it working)
  await openColumn(page, "customers", "cust_no", "Anna Nowak");
  await expect(toggle(page, "Natural key")).toHaveAttribute("aria-pressed", "true");
});

test("S23-02: an empty and an unchanged name write nothing; a taken name is refused", async ({ page }) => {
  await openConventions(page);
  const bk = rowOf(page, "BK");
  const version = (await stored({ code: "BK" }))!.version;

  await typeAndLeave(nameInput(bk), "   ");
  await expect(nameInput(bk)).toHaveValue("Business key");
  await typeAndLeave(nameInput(bk), "Business key");
  await expect(nameInput(bk)).toHaveValue("Business key");
  expect((await stored({ code: "BK" }))!.version).toBe(version);

  for (const taken of ["Personal data", "pii", "PERSONAL_DATA", "t-e-c-h"]) {
    await typeAndLeave(nameInput(bk), taken);
    await expect(bk.getByTestId("classification-name-error")).toHaveText("That name is taken");
  }
  expect((await stored({ code: "BK" }))!).toMatchObject({ name: "Business key", version });
  // a table classification's name is free for a column classification
  await typeAndLeave(nameInput(bk), "Master data");
  await expect.poll(async () => (await stored({ code: "BK" }))?.name).toBe("Master data");
  await expect(bk.getByTestId("classification-name-error")).toHaveCount(0);
});
