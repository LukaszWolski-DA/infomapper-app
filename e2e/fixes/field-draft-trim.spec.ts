import { expect, test } from "../slice-07c/fixtures";
import { columnId, expectToast, loadModel, openColumn, undo } from "../slice-07c/helpers";

// fix/field-draft-after-undo (slice 23's note "A text area whose command trims may keep an untrimmed draft"): a source
// column's note is stored trimmed while its field, which has no `prepare`, keeps the typed spaces as a draft; an Undo
// then leaves the typed text in the field. No race: the page has drawn the save (its version) before Undo is pressed.

const noteText = async (id: string) => (await loadModel()).sourceColumns.find((c) => c.id === id)!.note_text;

test("a column's note typed with spaces around it: after its save and an Undo the field shows the stored value", async ({ page }) => {
  await openColumn(page, "customers", "cust_no");
  const note = page.getByTestId("panel-source-column").getByTestId("input-source-note");
  const custNo = await columnId("customers", "cust_no");
  await note.fill("  Values like C-00012.  ");
  await note.blur();
  await expectToast(page, "Note saved on cust_no");
  await expect.poll(() => noteText(custNo)).toBe("Values like C-00012.");
  // the save's page is drawn: the field has the stored row's version
  await expect(note).toHaveAttribute("data-version", "2");
  await undo(page);
  await expect.poll(() => noteText(custNo)).toBeNull();
  await expect(note).toHaveValue("");
});
