import { expect, test } from "../slice-23/fixtures";
import { definitionInput, expectToast, nameInput, openConventions, rowOf, stored, typeAndLeave, undoButton } from "../slice-23/helpers";
import { holdUntil } from "../slice-13/helpers";

// fix/field-draft-after-undo (S23-02 failed now and then, known-limitations.md): an Undo sent before the page of a
// field's save has been drawn leaves the field showing the saved text while the stored value went back. The save's
// answer is held until Undo has been pressed, so the Undo always starts before the save's page commits (no timing luck):
// the save's page and the undo's are drawn in one commit and the field never sees its own value stored.

test("Undo pressed while a definition's save is on its way: the field shows the stored value again", async ({ page }) => {
  await openConventions(page, "Anna Nowak");
  const bk = rowOf(page, "BK");
  // a first undoable step, so the top bar's Undo is enabled while the definition's save is held
  await typeAndLeave(nameInput(bk), "Natural key");
  await expect.poll(async () => (await stored({ code: "BK" }))?.name).toBe("Natural key");
  await expect(undoButton(page)).toBeEnabled();

  const before = (await stored({ code: "BK" }))!.definition ?? "";
  const text = "The key the business uses.";
  const hold = await holdUntil(page, text);
  await typeAndLeave(definitionInput(bk), text);
  await expect.poll(() => hold.held()).toBe(true);
  await expect.poll(async () => (await stored({ code: "BK" }))?.definition).toBe(text);

  // Undo waits on the save chain for the held save, then undoes it
  await undoButton(page).click();
  hold.release();
  await hold.given;
  await expectToast(page, "Undone: Change definition of Natural key");
  await expect.poll(async () => (await stored({ code: "BK" }))?.definition ?? "").toBe(before);
  await expect(definitionInput(bk)).toHaveValue(before);
});
